import { useMemo, useEffect, useRef, useState } from 'react';
import type { Lesson } from '../data/lessons';
import { getLessonSlides, getPdfPageSlides } from '../data/slides';
import { createRealtimeMap } from '../utils/smartMap';
import type { KnowledgeMap, KnowledgeNode } from '../utils/smartMap';
import { requestAiMap } from '../utils/aiMap';
import { KnowledgeFlow } from './KnowledgeFlow';
import { SlideLearningWorkspace } from './SlideLearningWorkspace';
import { combineSlideNotes, restoreSlideThoughts, updateSlideNote } from '../utils/slideNotes';
import { CommunityQuestions } from './CommunityQuestions';
import { PdfSlideWorkspace } from './PdfSlideWorkspace';
import { LessonSummary } from './LessonSummary';
import { persistCloudMap, persistCloudNote, recordStudentActivity } from '../utils/courseStore';
import { builtInSlidePdfUrl } from './SelectablePdfPage';
import { loadCloudLearningState } from '../utils/cloudClassroom';

const EMPTY_MAP: KnowledgeMap = { nodes: [], edges: [] };

export function LearningConsole({ lesson, classId, onClose }: { lesson: Lesson; classId: string; onClose: () => void }) {
  const [tab, setTab] = useState<'brief' | 'summary' | 'map' | 'community'>('brief');
  const [map, setMap] = useState<KnowledgeMap>(EMPTY_MAP);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [thoughts, setThoughts] = useState('');
  const [thoughtsLessonId, setThoughtsLessonId] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideNotes, setSlideNotes] = useState<Record<string, string>>({});
  const [isThinking, setIsThinking] = useState(false);
  const [mapSource, setMapSource] = useState<'local' | 'ai' | 'fallback'>('local');
  const [analysisError, setAnalysisError] = useState('');
  const [communitySlideId, setCommunitySlideId] = useState<string | undefined>();
  const noteActivityTimer = useRef<number | null>(null);
  const cloudNoteTimer = useRef<number | null>(null);
  const cloudNoteSaveChain = useRef(Promise.resolve());
  const pendingCloudNote = useRef<{ lessonId: string; slideNumber: number; content: string } | null>(null);
  const skipNextMapGeneration = useRef(false);
  const learningStateDirty = useRef(false);
  const learningStateLessonId = useRef<string | null>(null);
  const mapStorageKey = useMemo(() => `solar-note-map:${classId}:${lesson.id}`, [classId, lesson.id]);
  const notesStorageKey = useMemo(() => `solar-slide-notes:${classId}:${lesson.id}`, [classId, lesson.id]);

  const usesDay01Pdf = lesson.id === 'ai-foundations' || Boolean(lesson.pdfUrl);
  const [pdfPageCount, setPdfPageCount] = useState(42);
  const [pdfLoadedLessonId, setPdfLoadedLessonId] = useState<string | null>(null);
  const slides = usesDay01Pdf ? getPdfPageSlides(pdfPageCount) : getLessonSlides(lesson.id, lesson.name);

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
    const parsed = stored ? JSON.parse(stored) as KnowledgeMap : EMPTY_MAP;
    const normalized = {
      ...parsed,
      nodes: parsed.nodes.map((node) => ({ ...node, status: node.status ?? 'confirmed' })),
      edges: parsed.edges.map((edge) => ({ ...edge, label: edge.label ?? 'liên quan đến' })),
    };
    const storedNotes = localStorage.getItem(notesStorageKey);
    let nextSlideNotes: Record<string, string> = {};
    try {
      nextSlideNotes = storedNotes ? JSON.parse(storedNotes) : {};
    } catch {
      localStorage.removeItem(notesStorageKey);
    }
    const restoredThoughts = restoreSlideThoughts(slides, nextSlideNotes, normalized.sourceNote);
    setSlideNotes(nextSlideNotes);
    // Only real slide notes may trigger map generation. A saved map's sourceNote
    // can be stale/demo data and must not recreate a map for an empty notebook.
    setMap(restoredThoughts ? normalized : EMPTY_MAP);
    setThoughts(restoredThoughts);
    setThoughtsLessonId(lesson.id);
    setSlideIndex(0);
    setSelectedId(null);
    setTab('brief');
    setCommunitySlideId(undefined);
    let active = true;
    loadCloudLearningState(classId, lesson.id).then((cloud) => {
      if (!active || learningStateDirty.current) return;
      const cloudNotes = Object.fromEntries(cloud.notes.flatMap((note) => {
        const slide = slides[note.slide_number - 1];
        return slide ? [[slide.id, note.content]] : [];
      }));
      if (Object.keys(cloudNotes).length) {
        setSlideNotes(cloudNotes);
        if (cloud.map && typeof cloud.map === 'object') skipNextMapGeneration.current = true;
        setThoughts(combineSlideNotes(slides, cloudNotes));
      }
      if (cloud.map && typeof cloud.map === 'object') setMap(cloud.map as KnowledgeMap);
    }).catch((error) => console.error('Không tải được dữ liệu học từ Supabase:', error));
    return () => { active = false; };
  }, [classId, lesson.id, lesson.pdfUrl, pdfLoadedLessonId, pdfPageCount, mapStorageKey, notesStorageKey]);

  useEffect(() => {
    if (thoughtsLessonId !== lesson.id) return;
    if (skipNextMapGeneration.current) {
      skipNextMapGeneration.current = false;
      return;
    }
    const note = thoughts.trim();
    const controller = new AbortController();
    if (!note) {
      setMap(EMPTY_MAP);
      setIsThinking(false);
      setMapSource('local');
      setAnalysisError('');
      return () => controller.abort();
    }

    const localMap = createRealtimeMap(lesson.id, thoughts);
    setMap((current) => ({ ...localMap, nodes: localMap.nodes.map((node) => {
      const existing = current.nodes.find((item) => item.id === node.id);
      return existing ? { ...node, x: existing.x, y: existing.y, status: existing.status } : node;
    }) }));
    setMapSource('local');
    setIsThinking(true);
    setAnalysisError('');
    const timer = window.setTimeout(async () => {
      try {
        const result = await requestAiMap(thoughts, { name: lesson.name }, map, controller.signal);
        setMap(result);
        setSelectedId(null);
        setMapSource('ai');
      } catch (error) {
        if (controller.signal.aborted) return;
        setMapSource('fallback');
        setAnalysisError(error instanceof Error ? error.message : 'AI tạm thời không khả dụng.');
      } finally {
        if (!controller.signal.aborted) setIsThinking(false);
      }
    }, 900);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [lesson.id, thoughts, thoughtsLessonId]);

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
    setThoughts('');
    setSlideNotes({});
    localStorage.removeItem(notesStorageKey);
    localStorage.removeItem(mapStorageKey);
    window.dispatchEvent(new CustomEvent('solar-note-map:saved', {
      detail: { classId, lessonId: lesson.id, nodeCount: 0 },
    }));
    setMap(EMPTY_MAP);
    setSelectedId(null);
  };

  const changeSlideNote = (content: string) => {
    learningStateDirty.current = true;
    const next = updateSlideNote(slideNotes, slides[slideIndex].id, content);
    setSlideNotes(next);
    setThoughts(combineSlideNotes(slides, next));
    setThoughtsLessonId(lesson.id);
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
          <span className="eyebrow">{lesson.subtitle}</span>
          <h2>{lesson.name}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Đóng">×</button>
      </header>

      <nav className="console-tabs" style={{ gridTemplateColumns: `repeat(${usesDay01Pdf ? 4 : 3}, 1fr)` }}>
        <button className={tab === 'brief' ? 'active' : ''} onClick={() => setTab('brief')}>Bài giảng</button>
        {usesDay01Pdf && <button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>Tóm tắt</button>}
        <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>Sơ đồ <span>{map.nodes.length}</span></button>
        <button className={tab === 'community' ? 'active' : ''} onClick={() => { setCommunitySlideId(undefined); setTab('community'); }}>Cộng đồng</button>
      </nav>

      <div className="console-content">
        {tab === 'brief' && (
          usesDay01Pdf ? <PdfSlideWorkspace
            page={slideIndex + 1}
            pageCount={slides.length}
            pdfUrl={lesson.pdfUrl ?? builtInSlidePdfUrl}
            onDocumentLoad={(pageCount) => { setPdfPageCount(pageCount); setPdfLoadedLessonId(lesson.id); }}
            useBundledPdfContext={lesson.id === 'ai-foundations'}
            note={slideNotes[slides[slideIndex].id] ?? ''}
            map={map}
            accent={lesson.color}
            isThinking={isThinking}
            mapSource={mapSource}
            onPageChange={(page) => setSlideIndex(page - 1)}
            onNoteChange={changeSlideNote}
            onOpenMap={() => setTab('map')}
            onAskCommunity={() => {
              setCommunitySlideId(slides[slideIndex].id);
              setTab('community');
            }}
            onUnderstandingChange={(status) => recordStudentActivity({ lessonId: lesson.id, slideId: slides[slideIndex].id, type: 'understanding_updated', metadata: { status } })}
          /> : <SlideLearningWorkspace
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
            onAskCommunity={() => {
              setCommunitySlideId(slides[slideIndex].id);
              setTab('community');
            }}
            onUnderstandingChange={(status) => recordStudentActivity({ lessonId: lesson.id, slideId: slides[slideIndex].id, type: 'understanding_updated', metadata: { status } })}
          />
        )}

        {tab === 'map' && (
          <section className="live-map-workspace">
            <header className="live-map-header">
              <div><span className="live-indicator"><i /> Sơ đồ trực tiếp</span><b>Ghi chú của bạn đang trở thành bản đồ kiến thức</b></div>
              <div className="live-actions">
                <button onClick={addNode}>＋ Thêm ý</button>
                <button disabled={isThinking} onClick={saveMap}>{saved ? '✓ Đã lưu' : isThinking ? 'Đang đồng bộ…' : 'Lưu sơ đồ'}</button>
                <button className="toolbar-more" onClick={resetSmartMap} title="Bắt đầu lại">↻</button>
              </div>
            </header>

            <aside className="live-note-panel">
              <div className="note-panel-heading"><span className="ai-kicker"><i>✦</i> Ghi chú tổng hợp</span><small>{thoughts.trim() ? `${thoughts.trim().split(/\s+/).length} từ` : 'Chưa có nội dung'}</small></div>
              <h3>Ghi chú từ các slide</h3>
              <p>Nội dung này được tổng hợp tự động. Quay lại bài giảng để viết hoặc chỉnh sửa ghi chú theo từng slide.</p>
              <textarea readOnly value={thoughts} placeholder="Ghi chú từ các slide sẽ xuất hiện tại đây." />
              <div className={`analysis-status ${isThinking ? 'thinking' : ''} ${mapSource === 'fallback' ? 'fallback' : ''}`} title={analysisError}><i>{isThinking ? '✦' : mapSource === 'fallback' ? '!' : '✓'}</i><span><b>{isThinking ? 'AI đang hiểu ghi chú…' : mapSource === 'ai' ? 'Đã đồng bộ bằng OpenAI' : mapSource === 'fallback' ? 'Đang dùng phân tích cục bộ' : thoughts.trim() ? 'Bản xem trước tức thì' : 'Sẵn sàng khi bạn bắt đầu viết'}</b><small>{analysisError || (map.nodes.length ? `${map.nodes.length} khái niệm · ${map.edges.length} mối quan hệ` : 'AI chỉ sử dụng nội dung trong ghi chú của bạn')}</small></span></div>
            </aside>

            <div className="live-canvas-area">
              <div className="canvas-caption"><div><span>Mind map bài học</span><small>{map.nodes.length ? 'Các nhánh tự động hình thành từ ghi chú' : 'Các ý tưởng sẽ xuất hiện tại đây'}</small></div>{map.nodes.length > 0 && <button onClick={() => setSelectedId(null)}>Toàn cảnh</button>}</div>
              <div className="knowledge-board">
                {map.nodes.length > 0 && <KnowledgeFlow map={map} accent={lesson.color} selectedId={selectedId} onSelect={chooseNode} />}
              {map.nodes.length === 0 && <div className="live-empty-state"><div className="orbit-loader"><i /><i /><span>✦</span></div><b>Sơ đồ sẽ lớn lên cùng ghi chú</b><p>Hãy viết một vài câu ở khung bên trái. Những khái niệm và mối quan hệ đầu tiên sẽ tự xuất hiện.</p></div>}
            </div>
            {selected && (
              <aside className="live-node-editor">
              <div className="node-editor">
                <div className="editor-heading"><span>✦ Nhận diện từ ghi chú</span><button onClick={() => setSelectedId(null)}>×</button></div>
                <input value={selected.title} onChange={(event) => updateNode({ title: event.target.value })} placeholder="Tên kiến thức" />
                <textarea value={selected.note} onChange={(event) => updateNode({ note: event.target.value })} placeholder="Giải thích bằng lời của bạn…" />
                <div className="node-editor-actions"><button onClick={() => updateNode({ status: 'confirmed' })}>✓ Xác nhận ý này</button><button onClick={removeNode}>Xóa khỏi sơ đồ</button></div>
              </div>
              </aside>
            )}
            </div>
          </section>
        )}

        {tab === 'summary' && <LessonSummary lesson={lesson} />}

        {tab === 'community' && (
          <CommunityQuestions
            lesson={lesson}
            classId={classId}
            slides={slides}
            initialSlideId={communitySlideId}
            onOpenSlide={(slideId) => {
              const index = slides.findIndex((slide) => slide.id === slideId);
              if (index >= 0) setSlideIndex(index);
              setTab('brief');
            }}
          />
        )}
      </div>
    </aside>
  );
}
