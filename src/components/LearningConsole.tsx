import { useEffect, useState } from 'react';
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
import { fetchLessonSummary } from '../utils/lessonSummary';

const EMPTY_MAP: KnowledgeMap = { nodes: [], edges: [] };

export function LearningConsole({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
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

  const usesDay01Pdf = lesson.id === 'ai-foundations';
  const slides = usesDay01Pdf ? getPdfPageSlides(42) : getLessonSlides(lesson.id, lesson.name, lesson.prompt);

  useEffect(() => {
    if (usesDay01Pdf) fetchLessonSummary(lesson.id).catch(() => undefined);
  }, [lesson.id, usesDay01Pdf]);

  useEffect(() => {
    const stored = localStorage.getItem(`solar-note-map:${lesson.id}`);
    const parsed = stored ? JSON.parse(stored) as KnowledgeMap : EMPTY_MAP;
    const normalized = {
      ...parsed,
      nodes: parsed.nodes.map((node) => ({ ...node, status: node.status ?? 'confirmed' })),
      edges: parsed.edges.map((edge) => ({ ...edge, label: edge.label ?? 'liên quan đến' })),
    };
    const storedNotes = localStorage.getItem(`solar-slide-notes:${lesson.id}`);
    let nextSlideNotes: Record<string, string> = {};
    try {
      nextSlideNotes = storedNotes ? JSON.parse(storedNotes) : {};
    } catch {
      localStorage.removeItem(`solar-slide-notes:${lesson.id}`);
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
  }, [lesson.id]);

  useEffect(() => {
    if (thoughtsLessonId !== lesson.id) return;
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
        const result = await requestAiMap(thoughts, { name: lesson.name, prompt: lesson.prompt }, map, controller.signal);
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
    setMap((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === selectedId ? { ...node, ...patch } : node),
    }));
  };

  const removeNode = () => {
    if (!selectedId) return;
    setMap((current) => ({
      nodes: current.nodes.filter((node) => node.id !== selectedId),
      edges: current.edges.filter((edge) => edge.from !== selectedId && edge.to !== selectedId),
    }));
    setSelectedId(null);
  };

  const chooseNode = (id: string) => {
    setSelectedId(id || null);
  };

  const saveMap = () => {
    localStorage.setItem(`solar-note-map:${lesson.id}`, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('solar-note-map:saved', {
      detail: { lessonId: lesson.id, nodeCount: map.nodes.length },
    }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const resetSmartMap = () => {
    setThoughts('');
    setSlideNotes({});
    localStorage.removeItem(`solar-slide-notes:${lesson.id}`);
    localStorage.removeItem(`solar-note-map:${lesson.id}`);
    window.dispatchEvent(new CustomEvent('solar-note-map:saved', {
      detail: { lessonId: lesson.id, nodeCount: 0 },
    }));
    setMap(EMPTY_MAP);
    setSelectedId(null);
  };

  const changeSlideNote = (content: string) => {
    const next = updateSlideNote(slideNotes, slides[slideIndex].id, content);
    setSlideNotes(next);
    setThoughts(combineSlideNotes(slides, next));
    setThoughtsLessonId(lesson.id);
    localStorage.setItem(`solar-slide-notes:${lesson.id}`, JSON.stringify(next));
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
              <div className="live-guide-question"><small>Câu hỏi dẫn đường</small><span>{lesson.prompt}</span></div>
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
