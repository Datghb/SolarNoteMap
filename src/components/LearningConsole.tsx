import { useMemo, useEffect, useRef, useState, Suspense, lazy } from 'react';
import type { Lesson } from '../data/lessons';
import { getLessonSlides, getPdfPageSlides } from '../data/slides';
import type { KnowledgeMap, KnowledgeNode } from '../utils/smartMap';
import { requestAiMap } from '../utils/aiMap';
import { fetchLessonKnowledgeMap, generateLessonKnowledgeMap, KnowledgeMapApiError } from '../utils/lessonKnowledgeMap';
import { KnowledgeFlow } from './KnowledgeFlow';
import { SlideLearningWorkspace } from './SlideLearningWorkspace';
import { updateSlideNote } from '../utils/slideNotes';
import { CommunityQuestions } from './CommunityQuestions';
import { LessonSummary } from './LessonSummary';
import { fetchLessonSummary, isExtractiveFallbackSummary } from '../utils/lessonSummary';
import { persistCloudMap, persistCloudNote, recordStudentActivity } from '../utils/courseStore';
import { builtInSlidePdfUrl } from './pdfUrls';
import { loadCloudLearningState } from '../utils/cloudClassroom';

// pdfjs-dist (~1.4MB worker + parser code) is only needed once a lesson that
// actually uses the PDF slide deck is opened, so keep it out of the initial
// bundle and load it on demand.
const PdfSlideWorkspace = lazy(() => import('./PdfSlideWorkspace').then((m) => ({ default: m.PdfSlideWorkspace })));

const EMPTY_MAP: KnowledgeMap = { nodes: [], edges: [] };

export function LearningConsole({ lesson, classId, summaryCacheScope, onClose, onRefreshPdf, canManageLesson = false }: { lesson: Lesson; classId: string; summaryCacheScope: string; onClose: () => void; onRefreshPdf: () => Promise<string>; canManageLesson?: boolean }) {
  const [tab, setTab] = useState<'brief' | 'summary' | 'map' | 'community'>('brief');
  const [map, setMap] = useState<KnowledgeMap>(EMPTY_MAP);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideNotes, setSlideNotes] = useState<Record<string, string>>({});
  const [isThinking, setIsThinking] = useState(false);
  const [mapSource, setMapSource] = useState<'local' | 'ai' | 'fallback'>('local');
  const [analysisError, setAnalysisError] = useState('');
  const [mapHydratedLessonId, setMapHydratedLessonId] = useState<string | null>(null);
  const [mapGenerationRevision, setMapGenerationRevision] = useState(0);
  const [availableSummary, setAvailableSummary] = useState(isExtractiveFallbackSummary(lesson.summary) ? '' : (lesson.summary?.trim() ?? ''));
  const noteActivityTimer = useRef<number | null>(null);
  const cloudNoteTimer = useRef<number | null>(null);
  const cloudNoteSaveChain = useRef(Promise.resolve());
  const pendingCloudNote = useRef<{ lessonId: string; slideNumber: number; content: string } | null>(null);
  const personalMap = useRef<KnowledgeMap | null>(null);
  const forceMapGeneration = useRef(false);
  const mapRetryCount = useRef(0);
  const learningStateDirty = useRef(false);
  const learningStateLessonId = useRef<string | null>(null);
  const mapStorageKey = useMemo(() => `solar-note-map:${classId}:${lesson.id}`, [classId, lesson.id]);
  const notesStorageKey = useMemo(() => `solar-slide-notes:${classId}:${lesson.id}`, [classId, lesson.id]);

  const usesDay01Pdf = lesson.id === 'ai-foundations' || Boolean(lesson.pdfUrl);
  const [pdfPageCount, setPdfPageCount] = useState(42);
  const [pdfLoadedLessonId, setPdfLoadedLessonId] = useState<string | null>(null);
  const slides = usesDay01Pdf ? getPdfPageSlides(pdfPageCount) : getLessonSlides(lesson.id, lesson.name);

  useEffect(() => {
    setAvailableSummary(isExtractiveFallbackSummary(lesson.summary) ? '' : (lesson.summary?.trim() ?? ''));
  }, [lesson.id, lesson.summary]);

  useEffect(() => {
    recordStudentActivity({ lessonId: lesson.id, slideId: slides[slideIndex]?.id, type: 'slide_viewed' });
  }, [lesson.id, slideIndex]);

  useEffect(() => () => {
    if (noteActivityTimer.current !== null) window.clearTimeout(noteActivityTimer.current);
    if (cloudNoteTimer.current !== null) window.clearTimeout(cloudNoteTimer.current);
    const pending = pendingCloudNote.current;
    if (pending) {
      cloudNoteSaveChain.current = cloudNoteSaveChain.current
        .catch(() => undefined)
        .then(() => persistCloudNote(pending.lessonId, pending.slideNumber, pending.content))
        .catch((error) => console.error('Không lưu được ghi chú lên Supabase:', error));
      pendingCloudNote.current = null;
    }
  }, []);

  useEffect(() => {
    if (lesson.pdfUrl && pdfLoadedLessonId !== lesson.id) return;
    if (learningStateLessonId.current === lesson.id && learningStateDirty.current) return;
    if (learningStateLessonId.current !== lesson.id) {
      learningStateLessonId.current = lesson.id;
      learningStateDirty.current = false;
    }
    const stored = localStorage.getItem(mapStorageKey);
    let parsed = EMPTY_MAP;
    try {
      parsed = stored ? JSON.parse(stored) as KnowledgeMap : EMPTY_MAP;
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) throw new Error('Invalid map');
    } catch {
      localStorage.removeItem(mapStorageKey);
      parsed = EMPTY_MAP;
    }
    const normalized = {
      ...parsed,
      nodes: parsed.nodes.map((node) => ({ ...node, status: node.status ?? 'confirmed' })),
      edges: parsed.edges.map((edge) => ({ ...edge, label: edge.label ?? 'liên quan đến' })),
    };
    personalMap.current = parsed.nodes.length ? normalized : null;
    mapRetryCount.current = 0;
    setMapHydratedLessonId(null);
    const storedNotes = localStorage.getItem(notesStorageKey);
    let nextSlideNotes: Record<string, string> = {};
    try {
      nextSlideNotes = storedNotes ? JSON.parse(storedNotes) : {};
    } catch {
      localStorage.removeItem(notesStorageKey);
    }
    setSlideNotes(nextSlideNotes);
    setMap(personalMap.current ?? EMPTY_MAP);
    setSlideIndex(0);
    setSelectedId(null);
    setTab('brief');
    let active = true;
    loadCloudLearningState(classId, lesson.id).then((cloud) => {
      if (!active || learningStateDirty.current) return;
      const cloudNotes = Object.fromEntries(cloud.notes.flatMap((note) => {
        const slide = slides[note.slide_number - 1];
        return slide ? [[slide.id, note.content]] : [];
      }));
      if (Object.keys(cloudNotes).length) setSlideNotes(cloudNotes);
      const cloudMap = cloud.map && typeof cloud.map === 'object' ? cloud.map as KnowledgeMap : null;
      if (cloudMap?.nodes?.length) {
        personalMap.current = cloudMap;
        setMap(cloudMap);
      }
    }).catch((error) => console.error('Không tải được dữ liệu học từ Supabase:', error))
      .finally(() => { if (active) setMapHydratedLessonId(lesson.id); });
    return () => { active = false; };
  }, [classId, lesson.id, lesson.pdfUrl, pdfLoadedLessonId, pdfPageCount, mapStorageKey, notesStorageKey]);

  useEffect(() => {
    if (mapHydratedLessonId !== lesson.id) return;
    const controller = new AbortController();
    setIsThinking(true);
    setAnalysisError('');
    const load = async () => {
      try {
        const shouldForce = forceMapGeneration.current;
        forceMapGeneration.current = false;
        const artifact = shouldForce && canManageLesson && lesson.pdfUrl
          ? await generateLessonKnowledgeMap(lesson.id, lesson.pdfUrl, true, controller.signal)
          : await fetchLessonKnowledgeMap(lesson.id, lesson.pdfUrl, controller.signal);
        const restored = personalMap.current?.sourceVersion === artifact.generatedAt
          ? personalMap.current
          : artifact.graph;
        setMap(restored);
        setSelectedId(null);
        setMapSource('ai');
        mapRetryCount.current = 0;
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof KnowledgeMapApiError && error.status === 404 && canManageLesson && lesson.pdfUrl) {
          try {
            const artifact = await generateLessonKnowledgeMap(lesson.id, lesson.pdfUrl, false, controller.signal);
            setMap(artifact.graph);
            setSelectedId(null);
            setMapSource('ai');
            setAnalysisError('');
            return;
          } catch (generationError) {
            if (controller.signal.aborted) return;
            console.error('Không tạo được sơ đồ dùng chung, chuyển sang fallback:', generationError);
          }
        }
        let fallbackSummary = availableSummary;
        if (error instanceof KnowledgeMapApiError && [404, 502].includes(error.status) && !fallbackSummary) {
          try {
            fallbackSummary = (await fetchLessonSummary(lesson.id, lesson.pdfUrl)).summary;
          } catch (summaryError) {
            if (controller.signal.aborted) return;
            console.error('Không tải được bản tóm tắt để tạo sơ đồ:', summaryError);
          }
        }
        if (error instanceof KnowledgeMapApiError && [404, 502].includes(error.status) && fallbackSummary) {
          try {
            const fallbackMap = await requestAiMap(
              fallbackSummary,
              { id: lesson.id, name: lesson.name },
              personalMap.current ?? EMPTY_MAP,
              controller.signal,
            );
            setMap(fallbackMap);
            setSelectedId(null);
            setMapSource('ai');
            setAnalysisError('');
            return;
          } catch (fallbackError) {
            if (controller.signal.aborted) return;
            setAnalysisError(fallbackError instanceof Error ? fallbackError.message : 'Không thể tạo sơ đồ từ bản tóm tắt.');
          }
        }
        setMapSource('fallback');
        if (error instanceof KnowledgeMapApiError && error.status === 404) {
          setMap(EMPTY_MAP);
          setAnalysisError(canManageLesson
            ? 'Sơ đồ đang được tạo từ nội dung từng slide.'
            : 'Giáo viên chưa tạo sơ đồ cho bài học này.');
          if (mapRetryCount.current < 12) {
            mapRetryCount.current += 1;
            forceMapGeneration.current = canManageLesson && Boolean(lesson.pdfUrl);
            window.setTimeout(() => {
              if (!controller.signal.aborted) setMapGenerationRevision((current) => current + 1);
            }, canManageLesson ? 1_000 : 5_000);
          }
        } else {
          setAnalysisError(error instanceof Error ? error.message : 'Không thể tải sơ đồ bài học.');
        }
      } finally {
        if (!controller.signal.aborted) setIsThinking(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [lesson.id, lesson.name, lesson.pdfUrl, availableSummary, mapHydratedLessonId, mapGenerationRevision, canManageLesson]);

  const selected = map.nodes.find((node) => node.id === selectedId);
  const addNode = () => {
    learningStateDirty.current = true;
    const index = map.nodes.length;
    const node: KnowledgeNode = {
      id: crypto.randomUUID(),
      title: `Ý chính ${index + 1}`,
      note: '',
      importance: index === 0 ? 'core' : 'support',
      status: 'confirmed',
      x: 24 + (index * 17) % 58,
      y: 24 + (index * 23) % 54,
    };
    setMap((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedId(node.id);
  };

  const updateNode = (patch: Partial<KnowledgeNode>) => {
    learningStateDirty.current = true;
    setMap((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === selectedId ? { ...node, ...patch } : node),
    }));
  };

  const removeNode = () => {
    if (!selectedId) return;
    learningStateDirty.current = true;
    setMap((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== selectedId),
      edges: current.edges.filter((edge) => edge.from !== selectedId && edge.to !== selectedId),
    }));
    setSelectedId(null);
  };

  const chooseNode = (id: string) => {
    setSelectedId(id || null);
  };

  const saveMap = async () => {
    localStorage.setItem(mapStorageKey, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('solar-note-map:saved', {
      detail: { classId, lessonId: lesson.id, nodeCount: map.nodes.length },
    }));
    try {
      await persistCloudMap(lesson.id, lesson.name, map);
      recordStudentActivity({ lessonId: lesson.id, type: 'map_saved', metadata: { nodeCount: map.nodes.length } });
      setSaved(true);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Không thể đồng bộ sơ đồ lên lớp học.');
    }
    window.setTimeout(() => setSaved(false), 1800);
  };

  const resetSmartMap = () => {
    learningStateDirty.current = true;
    personalMap.current = null;
    forceMapGeneration.current = canManageLesson;
    mapRetryCount.current = 0;
    localStorage.removeItem(mapStorageKey);
    window.dispatchEvent(new CustomEvent('solar-note-map:saved', {
      detail: { classId, lessonId: lesson.id, nodeCount: 0 },
    }));
    setMap(EMPTY_MAP);
    setSelectedId(null);
    setMapGenerationRevision((current) => current + 1);
  };

  const changeSlideNote = (content: string) => {
    learningStateDirty.current = true;
    const next = updateSlideNote(slideNotes, slides[slideIndex].id, content);
    setSlideNotes(next);
    localStorage.setItem(notesStorageKey, JSON.stringify(next));
    if (cloudNoteTimer.current !== null) window.clearTimeout(cloudNoteTimer.current);
    const savedSlideNumber = slideIndex + 1;
    const pending = { lessonId: lesson.id, slideNumber: savedSlideNumber, content };
    pendingCloudNote.current = pending;
    cloudNoteTimer.current = window.setTimeout(() => {
      if (pendingCloudNote.current !== pending) return;
      pendingCloudNote.current = null;
      cloudNoteSaveChain.current = cloudNoteSaveChain.current
        .catch(() => undefined)
        .then(() => persistCloudNote(lesson.id, savedSlideNumber, content))
        .catch((error) => console.error('Không lưu được ghi chú lên Supabase:', error));
    }, 600);
    if (noteActivityTimer.current !== null) window.clearTimeout(noteActivityTimer.current);
    noteActivityTimer.current = window.setTimeout(() => {
      recordStudentActivity({ lessonId: lesson.id, slideId: slides[slideIndex].id, type: 'note_updated', metadata: { wordCount: content.trim() ? content.trim().split(/\s+/).length : 0 } });
    }, 1200);
  };

  return (
    <aside className={`learning-console ${tab === 'brief' ? 'slide-open' : ''} ${tab === 'summary' ? 'summary-open' : ''} ${tab === 'map' ? 'map-open' : ''} ${tab === 'community' ? 'community-open' : ''}`} style={{ '--lesson-color': lesson.color } as React.CSSProperties}>
      <header className="console-header">
        <div>
          <h2>{lesson.name}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Đóng">×</button>
      </header>

      <nav className="console-tabs" style={{ gridTemplateColumns: `repeat(${usesDay01Pdf ? 4 : 3}, 1fr)` }}>
        <button className={tab === 'brief' ? 'active' : ''} onClick={() => setTab('brief')}>Bài giảng</button>
        {usesDay01Pdf && <button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>Tóm tắt</button>}
        <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>Sơ đồ <span>{map.nodes.length}</span></button>
        <button className={tab === 'community' ? 'active' : ''} onClick={() => setTab('community')}>Thảo luận</button>
      </nav>

      <div className="console-content">
        {tab === 'brief' && (
          usesDay01Pdf ? <Suspense fallback={<div className="pdf-render-loading" role="status"><i /><span>Đang tải slide…</span></div>}>
            <PdfSlideWorkspace
              page={slideIndex + 1}
              pageCount={slides.length}
              pdfUrl={lesson.pdfUrl ?? builtInSlidePdfUrl}
              onDocumentLoad={(pageCount) => { setPdfPageCount(pageCount); setPdfLoadedLessonId(lesson.id); }}
              useBundledPdfContext={lesson.id === 'ai-foundations'}
              onPdfAccessError={onRefreshPdf}
              lessonName={lesson.name}
              note={slideNotes[slides[slideIndex].id] ?? ''}
              map={map}
              accent={lesson.color}
              isThinking={isThinking}
              mapSource={mapSource}
              onPageChange={(page) => setSlideIndex(page - 1)}
              onNoteChange={changeSlideNote}
              onOpenMap={() => setTab('map')}
              onUnderstandingChange={(status) => recordStudentActivity({ lessonId: lesson.id, slideId: slides[slideIndex].id, type: 'understanding_updated', metadata: { status } })}
            />
          </Suspense> : <SlideLearningWorkspace
            slides={slides}
            index={slideIndex}
            note={slideNotes[slides[slideIndex].id] ?? ''}
            map={map}
            accent={lesson.color}
            isThinking={isThinking}
            mapSource={mapSource}
            onIndexChange={setSlideIndex}
            onNoteChange={changeSlideNote}
            onOpenMap={() => setTab('map')}
            onUnderstandingChange={(status) => recordStudentActivity({ lessonId: lesson.id, slideId: slides[slideIndex].id, type: 'understanding_updated', metadata: { status } })}
          />
        )}

        {tab === 'map' && (
          <section className="live-map-workspace">
            <header className="live-map-header">
              <div><span className="live-indicator"><i /> Sơ đồ AI</span><b>Bản tóm tắt slide đang trở thành bản đồ kiến thức</b></div>
              <div className="live-actions">
                <button onClick={addNode}>＋ Thêm ý</button>
                <button disabled={isThinking} onClick={saveMap}>{saved ? '✓ Đã lưu' : isThinking ? 'Đang đồng bộ…' : 'Lưu sơ đồ'}</button>
                <button className="toolbar-more" onClick={resetSmartMap} title="Bắt đầu lại">↻</button>
              </div>
            </header>

            <div className="live-canvas-area">
              <div className="canvas-caption"><div><span>Mind map bài học</span><small>{map.nodes.length ? 'Các nhánh được hình thành từ bản tóm tắt slide' : 'Các khái niệm sẽ xuất hiện tại đây'}</small></div>{map.nodes.length > 0 && <button onClick={() => setSelectedId(null)}>Toàn cảnh</button>}</div>
              <div className="knowledge-board">
                {map.nodes.length > 0 && <KnowledgeFlow map={map} accent={lesson.color} selectedId={selectedId} onSelect={chooseNode} />}
              {map.nodes.length === 0 && <div className="live-empty-state"><div className="orbit-loader"><i /><i /><span>✦</span></div><b>Chưa có dữ liệu để tạo sơ đồ</b><p>{analysisError || 'Sơ đồ sẽ tự động xuất hiện sau khi bản tóm tắt bài giảng được tạo.'}</p></div>}
            </div>
            {selected && (
              <aside className="live-node-editor">
              <div className="node-editor">
                <div className="editor-heading"><span>✦ Nhận diện từ tóm tắt</span><button onClick={() => setSelectedId(null)}>×</button></div>
                <input value={selected.title} onChange={(event) => updateNode({ title: event.target.value })} placeholder="Tên kiến thức" />
                <textarea value={selected.note} onChange={(event) => updateNode({ note: event.target.value })} placeholder="Giải thích bằng lời của bạn…" />
                {selected.slideNumbers?.length ? <button className="node-slide-link" onClick={() => { setSlideIndex(selected.slideNumbers![0] - 1); setTab('brief'); }}>Mở slide {selected.slideNumbers[0]} →</button> : null}
                <div className="node-editor-actions"><button onClick={() => updateNode({ status: 'confirmed' })}>✓ Xác nhận ý này</button><button onClick={removeNode}>Xóa khỏi sơ đồ</button></div>
              </div>
              </aside>
            )}
            </div>
          </section>
        )}

        {tab === 'summary' && <LessonSummary lesson={lesson} cacheScope={summaryCacheScope} onRefreshPdf={onRefreshPdf} canGenerateKeywords={canManageLesson} onSummaryReady={setAvailableSummary} />}

        {tab === 'community' && <CommunityQuestions
          lesson={lesson}
          classId={classId}
          slides={slides}
          onOpenSlide={(slideId) => {
            const index = slides.findIndex((slide) => slide.id === slideId);
            if (index >= 0) setSlideIndex(index);
            setTab('brief');
          }}
        />}

      </div>
    </aside>
  );
}
