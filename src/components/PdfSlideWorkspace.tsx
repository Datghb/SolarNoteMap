import { useEffect, useState } from 'react';
import pdfUrl from '../../day01-llm-foundation.pdf?url';
import type { KnowledgeMap } from '../utils/smartMap';
import { addSlidePin, type SlidePin } from '../utils/slideNotes';
import { askSlideAI } from '../utils/slideAi';
import { KnowledgeFlow } from './KnowledgeFlow';

type Understanding = 'understood' | 'question' | null;
type InteractionMode = 'note' | 'ask' | null;
type SlideAnchor = { x: number; y: number };

export function PdfSlideWorkspace({
  lessonId,
  page,
  pageCount,
  note,
  map,
  accent,
  isThinking,
  mapSource,
  onPageChange,
  onNoteChange,
  onOpenMap,
  onAskCommunity,
}: {
  lessonId: string;
  page: number;
  pageCount: number;
  note: string;
  map: KnowledgeMap;
  accent: string;
  isThinking: boolean;
  mapSource: 'local' | 'ai' | 'fallback';
  onPageChange: (page: number) => void;
  onNoteChange: (note: string) => void;
  onOpenMap: () => void;
  onAskCommunity: () => void;
}) {
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(null);
  const [anchor, setAnchor] = useState<SlideAnchor | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [aiError, setAiError] = useState('');
  const [asking, setAsking] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [pins, setPins] = useState<SlidePin[]>([]);
  const [understanding, setUnderstanding] = useState<Record<number, Understanding>>({});
  const status = understanding[page] ?? null;

  useEffect(() => {
    const stored = localStorage.getItem(`solar-slide-pins:${lessonId}`);
    try { setPins(stored ? JSON.parse(stored) : []); } catch { setPins([]); }
  }, [lessonId]);

  const pagePins = pins.filter((pin) => pin.page === page);
  const chooseSlidePoint = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactionMode) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setAnchor({
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    });
    setAnswer('');
    setAiError('');
  };
  const saveAnchoredNote = () => {
    if (!anchor || !draftNote.trim()) return;
    const next = addSlidePin(pins, { page, ...anchor });
    setPins(next);
    localStorage.setItem(`solar-slide-pins:${lessonId}`, JSON.stringify(next));
    onNoteChange(`${note}${note.trim() ? '\n' : ''}• ${draftNote.trim()}`);
    setDraftNote('');
    setAnchor(null);
  };
  const removePin = (id: string) => {
    const next = pins.filter((pin) => pin.id !== id);
    setPins(next);
    localStorage.setItem(`solar-slide-pins:${lessonId}`, JSON.stringify(next));
  };
  const submitQuestion = async () => {
    if (!question.trim() || asking) return;
    setAsking(true);
    setAiError('');
    setAnswer('');
    try {
      const result = await askSlideAI({ page, question, note });
      setAnswer(result.answer);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI chưa thể trả lời lúc này.');
    } finally {
      setAsking(false);
    }
  };
  const saveAnswerToNote = () => {
    if (!answer) return;
    onNoteChange(`${note}${note.trim() ? '\n\n' : ''}Câu hỏi: ${question.trim()}\nAI giải thích: ${answer}`);
  };
  const selectMode = (mode: Exclude<InteractionMode, null>) => {
    setInteractionMode((current) => current === mode ? null : mode);
    setAnchor(null);
    setAnswer('');
    setAiError('');
  };

  return (
    <section className={`pdf-learning-workspace ${focusMode ? 'focus-mode' : ''}`}>
      <header className="pdf-toolbar">
        <div><span className="live-indicator"><i /> Day 01 · PDF</span><b>AI &amp; LLM Foundation</b></div>
        <div className="pdf-page-controls"><button disabled={page === 1} onClick={() => onPageChange(page - 1)}>←</button><span>Trang <b>{page}</b> / {pageCount}</span><button disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>→</button></div>
        <div className="pdf-view-actions"><button onClick={() => setFocusMode((value) => !value)}>{focusMode ? 'Thu nhỏ' : '⛶ Xem lớn'}</button><button className={interactionMode === 'note' ? 'pin-mode active' : 'pin-mode'} onClick={() => selectMode('note')}>✎ Note trên slide</button><button className={interactionMode === 'ask' ? 'pin-mode active ai-mode' : 'pin-mode'} onClick={() => selectMode('ask')}>✦ Hỏi AI</button></div>
      </header>

      <div className={`pdf-stage ${interactionMode ? 'pinning' : ''}`}>
        <iframe key={page} title={`Day 01 - trang ${page}`} src={`${pdfUrl}#page=${page}&view=Fit&zoom=page-fit&toolbar=0&navpanes=0&scrollbar=0`} />
        {interactionMode && <div className={`pdf-pin-layer ${interactionMode}`} onPointerDown={chooseSlidePoint} aria-label={interactionMode === 'ask' ? 'Bấm vào mục muốn hỏi AI' : 'Bấm vào vị trí muốn ghi chú'}>
          {pagePins.map((pin, index) => <button key={pin.id} style={{ left: `${pin.x}%`, top: `${pin.y}%` }} onPointerDown={(event) => event.stopPropagation()} onClick={() => removePin(pin.id)} title="Bấm để xóa ghim">{index + 1}</button>)}
          {!anchor && <span>{interactionMode === 'ask' ? 'Bấm vào mục trên slide bạn muốn hỏi AI' : 'Bấm vào vị trí bạn muốn ghi chú'}</span>}
        </div>}
        {!interactionMode && pagePins.map((pin, index) => <button className="pdf-pin passive" key={pin.id} style={{ left: `${pin.x}%`, top: `${pin.y}%` }} onClick={() => selectMode('note')}>{index + 1}</button>)}
        {anchor && <div className={`slide-context-composer ${interactionMode}`} style={{ left: `${Math.min(82, Math.max(18, anchor.x))}%`, top: `${Math.min(72, Math.max(18, anchor.y))}%` }} onPointerDown={(event) => event.stopPropagation()}>
          <header><span>{interactionMode === 'ask' ? '✦ Hỏi AI về mục này' : '✎ Ghi chú tại đây'}</span><button onClick={() => setAnchor(null)}>×</button></header>
          {interactionMode === 'note' ? <>
            <textarea autoFocus value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="Viết điều bạn hiểu hoặc cần nhớ…" />
            <button className="context-primary" disabled={!draftNote.trim()} onClick={saveAnchoredNote}>Lưu vào ghi chú</button>
          </> : <>
            <textarea autoFocus value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ví dụ: Khái niệm này nghĩa là gì?" onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submitQuestion(); }} />
            <button className="context-primary" disabled={!question.trim() || asking} onClick={submitQuestion}>{asking ? 'AI đang đọc slide…' : 'Gửi câu hỏi'}</button>
            {aiError && <p className="slide-ai-error">{aiError}</p>}
            {answer && <div className="slide-ai-answer"><b>AI giải thích</b><p>{answer}</p><button onClick={saveAnswerToNote}>＋ Lưu vào ghi chú</button></div>}
          </>}
        </div>}
      </div>

      <aside className="pdf-sidecar">
        <div className="inline-note-card pdf-note-card">
          <div><span><i>✎</i> Ghi chú trang {page}</span><small>{pagePins.length} ghim</small></div>
          <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="Ghi lại điều bạn hiểu, một ví dụ hoặc phần còn thắc mắc ở trang này…" />
          <div className="pdf-understanding"><button className={status === 'understood' ? 'active' : ''} onClick={() => setUnderstanding((current) => ({ ...current, [page]: status === 'understood' ? null : 'understood' }))}>✓ Đã hiểu</button><button className={status === 'question' ? 'active question' : ''} onClick={() => setUnderstanding((current) => ({ ...current, [page]: status === 'question' ? null : 'question' }))}>? Chưa rõ</button><button onClick={onAskCommunity}>Hỏi cộng đồng →</button></div>
          <div className="inline-ai-status"><i>{isThinking ? '✦' : mapSource === 'fallback' ? '!' : '✓'}</i><span>{isThinking ? 'AI đang cập nhật sơ đồ…' : mapSource === 'ai' ? 'Đã đồng bộ vào sơ đồ' : 'Sơ đồ cập nhật từ ghi chú'}</span></div>
        </div>
        <div className="inline-map-card pdf-mini-map"><header><div><span>Mind map đang hình thành</span><small>{map.nodes.length} ý · {map.edges.length} liên kết</small></div><button onClick={onOpenMap}>Mở rộng ↗</button></header><div className="mini-flow">{map.nodes.length ? <KnowledgeFlow compact map={map} accent={accent} onSelect={onOpenMap} /> : <div className="mini-map-empty"><i>✦</i><span>Ghi chú để tạo nhánh đầu tiên</span></div>}</div></div>
      </aside>

      <footer className="pdf-filmstrip"><button disabled={page === 1} onClick={() => onPageChange(page - 1)}>← Trang trước</button><input type="range" min="1" max={pageCount} value={page} onChange={(event) => onPageChange(Number(event.target.value))} /><button disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>Trang tiếp →</button></footer>
    </section>
  );
}
