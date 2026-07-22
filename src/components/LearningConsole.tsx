import { useEffect, useRef, useState } from 'react';
import type { Lesson } from '../data/lessons';

type Importance = 'minor' | 'detail' | 'support' | 'important' | 'core';

const IMPORTANCE_LEVELS: { value: Importance; label: string; description: string }[] = [
  { value: 'minor', label: 'Mức 1 · Tham khảo', description: 'Thông tin mở rộng' },
  { value: 'detail', label: 'Mức 2 · Bổ trợ', description: 'Ví dụ hoặc chi tiết phụ' },
  { value: 'support', label: 'Mức 3 · Quan trọng', description: 'Ý cần ghi nhớ' },
  { value: 'important', label: 'Mức 4 · Trọng yếu', description: 'Ý chính của một phần' },
  { value: 'core', label: 'Mức 5 · Cốt lõi', description: 'Trọng tâm của bài học' },
];

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

interface ReviewComment {
  id: string;
  author: string;
  content: string;
  target: string;
  replyTo?: string;
  createdAt: string;
}

const EMPTY_MAP: KnowledgeMap = { nodes: [], edges: [] };
const COMMUNITY = [
  { name: 'Minh Anh', nodes: 8, comment: 'Phân biệt ví dụ AI và automation rất rõ.' },
  { name: 'Gia Huy', nodes: 6, comment: 'Sơ đồ gọn, có thể thêm phần dữ liệu đầu vào.' },
  { name: 'Thảo Linh', nodes: 11, comment: 'Nhiều liên kết thực tế, dễ hình dung.' },
];
const COMMUNITY_PREVIEW_NODES = [
  { title: 'Khái niệm chính', level: 5, x: 50, y: 48, note: 'AI là khả năng của máy tính thực hiện các nhiệm vụ thường cần trí thông minh con người.', example: 'Nhận diện hình ảnh, hiểu ngôn ngữ và hỗ trợ ra quyết định.' },
  { title: 'Dữ liệu', level: 4, x: 23, y: 24, note: 'Dữ liệu là nguyên liệu giúp hệ thống AI học được các mẫu và quy luật.', example: 'Ảnh đã gắn nhãn được dùng để huấn luyện mô hình phân loại.' },
  { title: 'Mô hình', level: 3, x: 78, y: 27, note: 'Mô hình là kết quả của quá trình học từ dữ liệu và được dùng để dự đoán.', example: 'Mô hình dự đoán một email có phải thư rác hay không.' },
  { title: 'Ứng dụng', level: 2, x: 25, y: 76, note: 'AI được ứng dụng để tự động hóa hoặc hỗ trợ con người xử lý vấn đề.', example: 'Trợ lý học tập, chẩn đoán hình ảnh và hệ thống gợi ý.' },
  { title: 'Rủi ro', level: 1, x: 75, y: 75, note: 'Kết quả AI có thể sai lệch nếu dữ liệu thiếu đại diện hoặc mục tiêu thiết kế chưa phù hợp.', example: 'Mô hình nhận diện hoạt động kém với nhóm dữ liệu ít xuất hiện.' },
];

export function LearningConsole({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const [tab, setTab] = useState<'brief' | 'map' | 'community'>('brief');
  const [map, setMap] = useState<KnowledgeMap>(EMPTY_MAP);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [reviewingStudent, setReviewingStudent] = useState<string | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentTarget, setCommentTarget] = useState('Toàn bộ sơ đồ');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [selectedPreviewNode, setSelectedPreviewNode] = useState<string | null>(null);
  const [hoveredPreviewNode, setHoveredPreviewNode] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`solar-note-map:${lesson.id}`);
    setMap(stored ? JSON.parse(stored) : EMPTY_MAP);
    setSelectedId(null);
    setLinkFrom(null);
    setTab('brief');
    setZoom(1);
    setReviewingStudent(null);
  }, [lesson.id]);

  useEffect(() => {
    if (!reviewingStudent) return;
    const stored = localStorage.getItem(`solar-note-reviews:${lesson.id}:${reviewingStudent}`);
    try {
      setComments(stored ? JSON.parse(stored) : []);
    } catch {
      setComments([]);
    }
    setCommentText('');
    setCommentTarget('Toàn bộ sơ đồ');
    setReplyTo(null);
    setSelectedPreviewNode(null);
    setHoveredPreviewNode(null);
  }, [lesson.id, reviewingStudent]);

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
      const rawX = ((pointerEvent.clientX - bounds.left) / bounds.width) * 100;
      const rawY = ((pointerEvent.clientY - bounds.top) / bounds.height) * 100;
      const minX = 50 + (4 - 50) / zoom;
      const maxX = 50 + (96 - 50) / zoom;
      const minY = 50 + (5 - 50) / zoom;
      const maxY = 50 + (95 - 50) / zoom;
      const x = Math.min(maxX, Math.max(minX, 50 + (rawX - 50) / zoom));
      const y = Math.min(maxY, Math.max(minY, 50 + (rawY - 50) / zoom));
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

  const submitComment = () => {
    const content = commentText.trim();
    if (!content || !reviewingStudent) return;
    const next = [...comments, {
      id: crypto.randomUUID(),
      author: 'Anh Nguyen',
      content,
      target: commentTarget,
      replyTo: replyTo ?? undefined,
      createdAt: new Date().toISOString(),
    }];
    setComments(next);
    localStorage.setItem(`solar-note-reviews:${lesson.id}:${reviewingStudent}`, JSON.stringify(next));
    setCommentText('');
    setReplyTo(null);
  };

  return (
    <aside className={`learning-console ${tab === 'map' ? 'map-open' : ''} ${tab === 'community' && reviewingStudent ? 'community-open' : ''}`} style={{ '--lesson-color': lesson.color } as React.CSSProperties}>
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
            <div className="knowledge-board" ref={boardRef} onWheel={(event) => {
              event.preventDefault();
              setZoom((value) => Math.min(1.8, Math.max(0.45, value + (event.deltaY < 0 ? 0.1 : -0.1))));
            }}>
              <div className="zoom-controls">
                <button onClick={() => setZoom((value) => Math.max(0.45, value - 0.1))} aria-label="Thu nhỏ">−</button>
                <button className="zoom-value" onClick={() => setZoom(1)} title="Đặt lại 100%">{Math.round(zoom * 100)}%</button>
                <button onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))} aria-label="Phóng to">＋</button>
              </div>
              <div className="knowledge-stage" style={{ transform: `scale(${zoom})` }}>
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
            </div>
            {selected && (
              <div className="node-editor">
                <div className="editor-heading"><span>Chỉnh hạt kiến thức</span><button onClick={removeNode}>Xóa</button></div>
                <input value={selected.title} onChange={(event) => updateNode({ title: event.target.value })} placeholder="Tên kiến thức" />
                <textarea value={selected.note} onChange={(event) => updateNode({ note: event.target.value })} placeholder="Giải thích bằng lời của bạn…" />
                <div className="importance-options">
                  {IMPORTANCE_LEVELS.map((level) => (
                    <button key={level.value} className={`${level.value} ${selected.importance === level.value ? 'active' : ''}`} onClick={() => updateNode({ importance: level.value })}>
                      <i /><span>{level.label}</span><small>{level.description}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === 'community' && (
          <section className="community-view">
            {!reviewingStudent ? <>
              <div className="community-intro"><span>12 sơ đồ đang bay quanh hành tinh</span><p>Xem cách mỗi học viên kết nối cùng một bài học theo góc nhìn riêng.</p></div>
              {COMMUNITY.map((student, index) => (
                <article
                  className="student-map"
                  key={student.name}
                  role="button"
                  tabIndex={0}
                  onPointerDown={() => setReviewingStudent(student.name)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setReviewingStudent(student.name);
                  }}
                >
                  <div className="avatar">{student.name.slice(0, 1)}</div>
                  <div><b>{student.name}</b><span>{student.nodes} hạt kiến thức · {index + 2} liên kết</span><p>“{student.comment}”</p></div>
                  <button type="button" onPointerDown={(event) => { event.stopPropagation(); setReviewingStudent(student.name); }}>Xem →</button>
                </article>
              ))}
            </> : (
              <div className="review-workspace">
                <div className="review-topline"><button onClick={() => setReviewingStudent(null)}>← Danh sách</button><div><b>Sơ đồ của {reviewingStudent}</b><span>{lesson.shortName}</span></div></div>
                <div className="community-map-preview">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="50" y1="48" x2="23" y2="24"/><line x1="50" y1="48" x2="78" y2="27"/><line x1="50" y1="48" x2="25" y2="76"/><line x1="50" y1="48" x2="75" y2="75"/></svg>
                  {COMMUNITY_PREVIEW_NODES.map((node) => <button key={node.title} className={`preview-node level-${node.level} ${selectedPreviewNode === node.title ? 'active' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onPointerEnter={() => setHoveredPreviewNode(node.title)} onPointerLeave={() => setHoveredPreviewNode(null)} onFocus={() => setHoveredPreviewNode(node.title)} onBlur={() => setHoveredPreviewNode(null)} onClick={() => { setSelectedPreviewNode(node.title); setCommentTarget(node.title); }}><span>{node.title}</span></button>)}
                  {hoveredPreviewNode && (() => {
                    const node = COMMUNITY_PREVIEW_NODES.find((item) => item.title === hoveredPreviewNode)!;
                    return <div className={`node-hover-card ${node.x > 60 ? 'place-left' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }}><small>Mức {node.level}</small><b>{node.title}</b><p>{node.note}</p><span>{node.example}</span><i>Nhấn để ghim và nhận xét</i></div>;
                  })()}
                </div>
                <aside className="review-panel">
                  {selectedPreviewNode && (() => {
                    const node = COMMUNITY_PREVIEW_NODES.find((item) => item.title === selectedPreviewNode)!;
                    return <section className="preview-node-detail"><div><span>Mức {node.level} · Nội dung node</span><button onClick={() => setSelectedPreviewNode(null)}>×</button></div><h3>{node.title}</h3><p>{node.note}</p><small>Ví dụ / ghi chú</small><blockquote>{node.example}</blockquote></section>;
                  })()}
                  <div className="review-heading"><b>Nhận xét</b><span>{comments.length}</span></div>
                  <div className="comment-list">
                    {comments.length === 0 && <p className="no-comments">Chưa có nhận xét. Hãy đặt một câu hỏi hoặc góp ý cụ thể.</p>}
                    {comments.map((comment) => <article key={comment.id} className={comment.replyTo ? 'reply' : ''}><div><b>{comment.author}</b><small>{comment.target}</small></div><p>{comment.content}</p><button onClick={() => setReplyTo(comment.id)}>Phản hồi</button></article>)}
                  </div>
                  <div className="comment-composer">
                    {replyTo && <div className="replying">Đang phản hồi một nhận xét <button onClick={() => setReplyTo(null)}>×</button></div>}
                    <label>Nhận xét về</label>
                    <select value={commentTarget} onChange={(event) => { setCommentTarget(event.target.value); setSelectedPreviewNode(event.target.value === 'Toàn bộ sơ đồ' ? null : event.target.value); }}><option>Toàn bộ sơ đồ</option>{COMMUNITY_PREVIEW_NODES.map((item) => <option key={item.title}>{item.title}</option>)}</select>
                    <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Đặt câu hỏi hoặc đưa ra góp ý cụ thể…" />
                    <button className="send-comment" disabled={!commentText.trim()} onClick={submitComment}>Gửi nhận xét →</button>
                  </div>
                </aside>
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}
