import { useEffect, useRef, useState } from 'react';
import type { Lesson } from '../data/lessons';

type Importance = 'core' | 'support' | 'detail';

interface KnowledgeNode {
  id: string;
  title: string;
  note: string;
  importance: Importance;
  x: number;
  y: number;
}

interface KnowledgeEdge {
  from: string;
  to: string;
}

interface KnowledgeMap {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

const EMPTY_MAP: KnowledgeMap = { nodes: [], edges: [] };
const COMMUNITY = [
  { name: 'Minh Anh', nodes: 8, comment: 'Phân biệt ví dụ AI và automation rất rõ.' },
  { name: 'Gia Huy', nodes: 6, comment: 'Sơ đồ gọn, có thể thêm phần dữ liệu đầu vào.' },
  { name: 'Thảo Linh', nodes: 11, comment: 'Nhiều liên kết thực tế, dễ hình dung.' },
];

export function LearningConsole({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const [tab, setTab] = useState<'brief' | 'map' | 'community'>('brief');
  const [map, setMap] = useState<KnowledgeMap>(EMPTY_MAP);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`solar-note-map:${lesson.id}`);
    setMap(stored ? JSON.parse(stored) : EMPTY_MAP);
    setSelectedId(null);
    setLinkFrom(null);
    setTab('brief');
  }, [lesson.id]);

  const selected = map.nodes.find((node) => node.id === selectedId);

  const addNode = () => {
    const index = map.nodes.length;
    const node: KnowledgeNode = {
      id: crypto.randomUUID(),
      title: `Ý chính ${index + 1}`,
      note: '',
      importance: index === 0 ? 'core' : 'support',
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
    setLinkFrom(null);
  };

  const chooseNode = (id: string) => {
    if (linkFrom && linkFrom !== id) {
      const exists = map.edges.some((edge) => edge.from === linkFrom && edge.to === id);
      if (!exists) setMap((current) => ({ ...current, edges: [...current.edges, { from: linkFrom, to: id }] }));
      setLinkFrom(null);
    }
    setSelectedId(id);
  };

  const moveNode = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (pointerEvent: PointerEvent) => {
      const bounds = boardRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const x = Math.min(94, Math.max(6, ((pointerEvent.clientX - bounds.left) / bounds.width) * 100));
      const y = Math.min(90, Math.max(10, ((pointerEvent.clientY - bounds.top) / bounds.height) * 100));
      setMap((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, x, y } : node) }));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  const saveMap = () => {
    localStorage.setItem(`solar-note-map:${lesson.id}`, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('solar-note-map:saved', {
      detail: { lessonId: lesson.id, nodeCount: map.nodes.length },
    }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <aside className="learning-console" style={{ '--lesson-color': lesson.color } as React.CSSProperties}>
      <header className="console-header">
        <div>
          <span className="eyebrow">{lesson.subtitle}</span>
          <h2>{lesson.name}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Đóng">×</button>
      </header>

      <nav className="console-tabs">
        <button className={tab === 'brief' ? 'active' : ''} onClick={() => setTab('brief')}>Nhiệm vụ</button>
        <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>Sơ đồ <span>{map.nodes.length}</span></button>
        <button className={tab === 'community' ? 'active' : ''} onClick={() => setTab('community')}>Cộng đồng</button>
      </nav>

      <div className="console-content">
        {tab === 'brief' && (
          <section className="brief-view">
            <div className="lesson-orb"><span>01</span></div>
            <p className="lesson-description">{lesson.description}</p>
            <div className="mission-card">
              <span className="eyebrow">Câu hỏi dẫn đường</span>
              <p>{lesson.prompt}</p>
            </div>
            <div className="steps">
              <div><b>1</b><span>Chọn các ý quan trọng sau buổi học</span></div>
              <div><b>2</b><span>Tạo hình cầu và điều chỉnh độ nổi bật</span></div>
              <div><b>3</b><span>Nối các ý có quan hệ rồi chia sẻ</span></div>
            </div>
            <button className="primary-button" onClick={() => setTab('map')}>Bắt đầu dựng sơ đồ <span>→</span></button>
          </section>
        )}

        {tab === 'map' && (
          <section className="map-view">
            <div className="map-toolbar">
              <button onClick={addNode}>＋ Hạt kiến thức</button>
              <button disabled={!selectedId} className={linkFrom ? 'linking' : ''} onClick={() => setLinkFrom(selectedId)}>{linkFrom ? 'Chọn hạt đích…' : '↗ Tạo liên kết'}</button>
              <button onClick={saveMap}>{saved ? '✓ Đã lưu' : 'Lưu sơ đồ'}</button>
            </div>
            <div className="knowledge-board" ref={boardRef}>
              {map.nodes.length === 0 && <button className="empty-map" onClick={addNode}><b>＋</b><span>Tạo hạt kiến thức đầu tiên</span><small>Mỗi hạt là một điều bạn hiểu sau buổi học</small></button>}
              <svg className="edge-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
                {map.edges.map((edge, index) => {
                  const from = map.nodes.find((node) => node.id === edge.from);
                  const to = map.nodes.find((node) => node.id === edge.to);
                  return from && to ? <line key={index} x1={from.x} y1={from.y} x2={to.x} y2={to.y} /> : null;
                })}
              </svg>
              {map.nodes.map((node) => (
                <button key={node.id} className={`knowledge-node ${node.importance} ${selectedId === node.id ? 'selected' : ''} ${linkFrom === node.id ? 'link-source' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => chooseNode(node.id)} onPointerDown={(event) => moveNode(event, node.id)}>
                  <span>{node.title}</span>
                </button>
              ))}
            </div>
            {selected && (
              <div className="node-editor">
                <div className="editor-heading"><span>Chỉnh hạt kiến thức</span><button onClick={removeNode}>Xóa</button></div>
                <input value={selected.title} onChange={(event) => updateNode({ title: event.target.value })} placeholder="Tên kiến thức" />
                <textarea value={selected.note} onChange={(event) => updateNode({ note: event.target.value })} placeholder="Giải thích bằng lời của bạn…" />
                <div className="importance-options">
                  {(['detail', 'support', 'core'] as Importance[]).map((level) => <button key={level} className={selected.importance === level ? 'active' : ''} onClick={() => updateNode({ importance: level })}>{level === 'detail' ? 'Chi tiết' : level === 'support' ? 'Quan trọng' : 'Cốt lõi'}</button>)}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === 'community' && (
          <section className="community-view">
            <div className="community-intro"><span>12 sơ đồ đang bay quanh hành tinh</span><p>Xem cách mỗi học viên kết nối cùng một bài học theo góc nhìn riêng.</p></div>
            {COMMUNITY.map((student, index) => (
              <article className="student-map" key={student.name}>
                <div className="avatar">{student.name.slice(0, 1)}</div>
                <div><b>{student.name}</b><span>{student.nodes} hạt kiến thức · {index + 2} liên kết</span><p>“{student.comment}”</p></div>
                <button>Xem</button>
              </article>
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}
