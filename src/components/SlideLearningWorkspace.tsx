import { useState } from 'react';
import type { LessonSlide } from '../data/slides';
import type { KnowledgeMap } from '../utils/smartMap';
import { KnowledgeFlow } from './KnowledgeFlow';

type Understanding = 'understood' | 'question' | null;

export function SlideLearningWorkspace({
  slides,
  index,
  note,
  map,
  accent,
  isThinking,
  mapSource,
  onIndexChange,
  onNoteChange,
  onOpenMap,
  onAskCommunity,
  onUnderstandingChange,
}: {
  slides: LessonSlide[];
  index: number;
  note: string;
  map: KnowledgeMap;
  accent: string;
  isThinking: boolean;
  mapSource: 'local' | 'ai' | 'fallback';
  onIndexChange: (index: number) => void;
  onNoteChange: (note: string) => void;
  onOpenMap: () => void;
  onAskCommunity: () => void;
  onUnderstandingChange: (status: 'understood' | 'question' | 'unmarked') => void;
}) {
  const slide = slides[index];
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [understanding, setUnderstanding] = useState<Record<string, Understanding>>({});
  const status = understanding[slide.id] ?? null;
  const changeUnderstanding = (next: Exclude<Understanding, null>) => {
    const value = status === next ? null : next;
    setUnderstanding((current) => ({ ...current, [slide.id]: value }));
    onUnderstandingChange(value ?? 'unmarked');
  };

  const changeSlide = (next: number) => {
    setSelectedPoint(null);
    onIndexChange(next);
  };

  return (
    <section className="slide-learning-workspace">
      <header className="slide-topline">
        <div><span className="live-indicator"><i /> Đang học</span><b>{slide.eyebrow}</b></div>
        <div className="slide-progress"><span>{index + 1} / {slides.length}</span><i><b style={{ width: `${((index + 1) / slides.length) * 100}%` }} /></i></div>
      </header>

      <div className="lecture-slide" style={{ '--slide-accent': accent } as React.CSSProperties}>
        <div className="slide-orbit-mark"><i /><i /><span>{String(index + 1).padStart(2, '0')}</span></div>
        <div className="slide-copy">
          <span>{slide.eyebrow}</span>
          <h3>{slide.title}</h3>
          <p>{slide.statement}</p>
        </div>
        <div className="slide-points">
          {slide.points.map((point) => (
            <button key={point.id} className={selectedPoint === point.id ? 'active' : ''} onClick={() => setSelectedPoint(selectedPoint === point.id ? null : point.id)}>
              <i>✦</i><span><b>{point.label}</b><small>{point.description}</small></span>
            </button>
          ))}
        </div>
        <div className="slide-question"><small>Câu hỏi dành cho bạn</small><p>{slide.question}</p></div>
        <div className="understanding-actions">
          <span>Slide này với bạn thế nào?</span>
          <button className={status === 'understood' ? 'active understood' : ''} onClick={() => changeUnderstanding('understood')}>✓ Đã hiểu</button>
          <button className={status === 'question' ? 'active question' : ''} onClick={() => changeUnderstanding('question')}>? Chưa rõ</button>
          <button onClick={onAskCommunity}>Hỏi cộng đồng →</button>
        </div>
      </div>

      <aside className="slide-sidecar">
        <div className="inline-note-card">
          <div><span><i>✎</i> Ghi chú slide {index + 1}</span><small>{note.trim() ? `${note.trim().split(/\s+/).length} từ` : 'Tự động lưu'}</small></div>
          {selectedPoint && <button className="note-context" onClick={() => setSelectedPoint(null)}>Đang ghi về: {slide.points.find((point) => point.id === selectedPoint)?.label} ×</button>}
          <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder={selectedPoint ? `Bạn hiểu gì về “${slide.points.find((point) => point.id === selectedPoint)?.label}”?` : 'Ghi nhanh điều bạn hiểu, thắc mắc hoặc một ví dụ…'} />
          <div className="inline-ai-status"><i>{isThinking ? '✦' : mapSource === 'fallback' ? '!' : '✓'}</i><span>{isThinking ? 'AI đang nối các ý…' : mapSource === 'ai' ? 'Đã đồng bộ vào sơ đồ' : mapSource === 'fallback' ? 'Đang dùng phân tích cục bộ' : 'Sơ đồ cập nhật khi bạn viết'}</span></div>
        </div>

        <div className="inline-map-card">
          <header><div><span>Mind map đang hình thành</span><small>{map.nodes.length} ý · {map.edges.length} liên kết</small></div><button onClick={onOpenMap}>Mở rộng ↗</button></header>
          <div className="mini-flow">
            {map.nodes.length ? <KnowledgeFlow compact map={map} accent={accent} onSelect={onOpenMap} /> : <div className="mini-map-empty"><i>✦</i><span>Bắt đầu ghi chú để tạo node đầu tiên</span></div>}
          </div>
        </div>
      </aside>

      <footer className="slide-navigation">
        <button disabled={index === 0} onClick={() => changeSlide(index - 1)}>← Slide trước</button>
        <div>{slides.map((item, itemIndex) => <button key={item.id} className={itemIndex === index ? 'active' : ''} onClick={() => changeSlide(itemIndex)} aria-label={`Mở slide ${itemIndex + 1}`} />)}</div>
        <button disabled={index === slides.length - 1} onClick={() => changeSlide(index + 1)}>Slide tiếp →</button>
      </footer>
    </section>
  );
}
