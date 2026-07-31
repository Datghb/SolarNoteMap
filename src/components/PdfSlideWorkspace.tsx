import { useEffect, useRef, useState } from 'react';
import type { KnowledgeMap } from '../utils/smartMap';
import { askSlideAI } from '../utils/slideAi';
import { KnowledgeFlow } from './KnowledgeFlow';
import { SelectablePdfPage } from './SelectablePdfPage';

type Understanding = 'understood' | 'question' | null;
type InteractionMode = 'region' | 'ask' | null;
type SlideAnchor = { x: number; y: number };
type SlideRegion = { x: number; y: number; width: number; height: number };

export function PdfSlideWorkspace({
  page,
  pageCount,
  pdfUrl,
  note,
  map,
  accent,
  isThinking,
  mapSource,
  onPageChange,
  onNoteChange,
  onOpenMap,
  onAskCommunity,
  onUnderstandingChange,
  onDocumentLoad,
  useBundledPdfContext,
  onPdfAccessError,
}: {
  page: number;
  pageCount: number;
  pdfUrl: string;
  note: string;
  map: KnowledgeMap;
  accent: string;
  isThinking: boolean;
  mapSource: 'local' | 'ai' | 'fallback';
  onPageChange: (page: number) => void;
  onNoteChange: (note: string) => void;
  onOpenMap: () => void;
  onAskCommunity: () => void;
  onUnderstandingChange: (status: 'understood' | 'question' | 'unmarked') => void;
  onDocumentLoad?: (pageCount: number) => void;
  useBundledPdfContext: boolean;
  onPdfAccessError?: () => Promise<void>;
}) {
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(null);
  const [anchor, setAnchor] = useState<SlideAnchor | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [aiError, setAiError] = useState('');
  const [asking, setAsking] = useState(false);
  const [regionDraft, setRegionDraft] = useState<SlideRegion | null>(null);
  const [pendingRegion, setPendingRegion] = useState<SlideRegion | null>(null);
  const [regionImage, setRegionImage] = useState('');
  const regionStart = useRef<SlideAnchor | null>(null);
  const composerDrag = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const wheelLocked = useRef(false);
  const wheelAccumulator = useRef(0);
  const wheelTimer = useRef<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [understanding, setUnderstanding] = useState<Record<number, Understanding>>({});
  const status = understanding[page] ?? null;
  const changeUnderstanding = (next: Exclude<Understanding, null>) => {
    const value = status === next ? null : next;
    setUnderstanding((current) => ({ ...current, [page]: value }));
    onUnderstandingChange(value ?? 'unmarked');
  };
  const hasMapContent = map.nodes.length > 0;
  useEffect(() => {
    setAnchor(null);
    setInteractionMode(null);
    setRegionDraft(null);
    setPendingRegion(null);
    setRegionImage('');
  }, [page]);

  useEffect(() => () => {
    if (wheelTimer.current !== null) window.clearTimeout(wheelTimer.current);
  }, []);

  const submitQuestion = async () => {
    if (!question.trim() || asking) return;
    setAsking(true);
    setAiError('');
    setAnswer('');
    try {
      const result = await askSlideAI({ page, question, note, image: regionImage, useBundledPdfContext });
      setAnswer(result.answer);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI chưa thể trả lời lúc này.');
    } finally {
      setAsking(false);
    }
  };
  const selectMode = (mode: Exclude<InteractionMode, null>) => {
    setInteractionMode((current) => current === mode ? null : mode);
    setPendingRegion(null);
    setRegionImage('');
    setAnchor(null);
    setAnswer('');
    setAiError('');
  };
  const pointInStage = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100)),
    };
  };
  const beginRegion = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointInStage(event);
    regionStart.current = start;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPendingRegion(null);
    setRegionDraft({ ...start, width: 0, height: 0 });
  };
  const updateRegion = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!regionStart.current) return;
    const point = pointInStage(event);
    setRegionDraft({
      x: Math.min(regionStart.current.x, point.x),
      y: Math.min(regionStart.current.y, point.y),
      width: Math.abs(point.x - regionStart.current.x),
      height: Math.abs(point.y - regionStart.current.y),
    });
  };
  const captureRegionImage = (region: SlideRegion, stage: HTMLDivElement) => {
    const source = stage.parentElement?.querySelector<HTMLCanvasElement>('.pdf-page-surface canvas');
    if (!source) return '';
    const stageBounds = stage.getBoundingClientRect();
    const canvasBounds = source.getBoundingClientRect();
    const left = stageBounds.left + stageBounds.width * region.x / 100;
    const top = stageBounds.top + stageBounds.height * region.y / 100;
    const right = left + stageBounds.width * region.width / 100;
    const bottom = top + stageBounds.height * region.height / 100;
    const clippedLeft = Math.max(left, canvasBounds.left);
    const clippedTop = Math.max(top, canvasBounds.top);
    const clippedRight = Math.min(right, canvasBounds.right);
    const clippedBottom = Math.min(bottom, canvasBounds.bottom);
    if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) return '';
    const scaleX = source.width / canvasBounds.width;
    const scaleY = source.height / canvasBounds.height;
    const sx = (clippedLeft - canvasBounds.left) * scaleX;
    const sy = (clippedTop - canvasBounds.top) * scaleY;
    const sw = (clippedRight - clippedLeft) * scaleX;
    const sh = (clippedBottom - clippedTop) * scaleY;
    const ratio = Math.min(1, 1000 / Math.max(sw, sh));
    const output = document.createElement('canvas');
    output.width = Math.max(1, Math.round(sw * ratio));
    output.height = Math.max(1, Math.round(sh * ratio));
    output.getContext('2d')?.drawImage(source, sx, sy, sw, sh, 0, 0, output.width, output.height);
    return output.toDataURL('image/jpeg', 0.78);
  };
  const finishRegion = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!regionDraft || regionDraft.width < 2 || regionDraft.height < 2) {
      setRegionDraft(null);
      regionStart.current = null;
      return;
    }
    setPendingRegion(regionDraft);
    setRegionImage(captureRegionImage(regionDraft, event.currentTarget));
    setRegionDraft(null);
    regionStart.current = null;
  };
  const openRegionQuestion = () => {
    if (!pendingRegion) return;
    setInteractionMode('ask');
    setAnchor({ x: pendingRegion.x + pendingRegion.width / 2 < 50 ? 53 : 5, y: Math.min(48, Math.max(8, pendingRegion.y)) });
    setQuestion('Hãy giải thích nội dung trong vùng slide mình đã chọn.');
  };
  const beginComposerDrag = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const composer = event.currentTarget.parentElement;
    if (!composer) return;
    const bounds = composer.getBoundingClientRect();
    composerDrag.current = { pointerId: event.pointerId, offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const moveComposer = (event: React.PointerEvent<HTMLElement>) => {
    if (!composerDrag.current || composerDrag.current.pointerId !== event.pointerId) return;
    const composer = event.currentTarget.parentElement;
    const stage = composer?.closest<HTMLElement>('.pdf-stage');
    if (!composer || !stage) return;
    const stageBounds = stage.getBoundingClientRect();
    const composerBounds = composer.getBoundingClientRect();
    const maxLeft = Math.max(8, stageBounds.width - composerBounds.width - 8);
    const maxTop = Math.max(8, stageBounds.height - composerBounds.height - 8);
    const left = Math.min(maxLeft, Math.max(8, event.clientX - stageBounds.left - composerDrag.current.offsetX));
    const top = Math.min(maxTop, Math.max(8, event.clientY - stageBounds.top - composerDrag.current.offsetY));
    setAnchor({ x: left / stageBounds.width * 100, y: top / stageBounds.height * 100 });
  };
  const endComposerDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (composerDrag.current?.pointerId !== event.pointerId) return;
    composerDrag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleSlideWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.slide-context-composer')) return;
    if (wheelLocked.current) return;
    wheelAccumulator.current += event.deltaY;
    if (Math.abs(wheelAccumulator.current) < 55) return;
    const direction = wheelAccumulator.current > 0 ? 1 : -1;
    const nextPage = Math.min(pageCount, Math.max(1, page + direction));
    wheelAccumulator.current = 0;
    if (nextPage === page) return;
    event.preventDefault();
    wheelLocked.current = true;
    onPageChange(nextPage);
    wheelTimer.current = window.setTimeout(() => { wheelLocked.current = false; }, 650);
  };
  return (
    <section className={`pdf-learning-workspace ${focusMode ? 'focus-mode' : ''}`}>
      <header className="pdf-toolbar">
        <div><span className="live-indicator"><i /> Day 01 · PDF</span><b>AI &amp; LLM Foundation</b></div>
        <div className="pdf-page-controls"><button disabled={page === 1} onClick={() => onPageChange(page - 1)}>←</button><span>Trang <b>{page}</b> / {pageCount}</span><button disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>→</button></div>
        <div className="pdf-view-actions"><button onClick={() => setFocusMode((value) => !value)}>{focusMode ? 'Thu nhỏ' : '⛶ Xem lớn'}</button><button className={interactionMode === 'region' ? 'pin-mode active ai-mode' : 'pin-mode'} onClick={() => selectMode('region')}>▱ Chọn vùng hỏi AI</button></div>
      </header>

      <div className="pdf-stage" onWheel={handleSlideWheel}>
        <SelectablePdfPage pageNumber={page} pdfUrl={pdfUrl} onDocumentLoad={onDocumentLoad} onPdfAccessError={onPdfAccessError} />
        {interactionMode === 'region' && <div className="region-select-layer region" onPointerDown={beginRegion} onPointerMove={updateRegion} onPointerUp={finishRegion}>
          {!regionDraft && !pendingRegion && <span>Kéo một khung quanh nội dung muốn hỏi AI</span>}
          {regionDraft && <i className="slide-region-box draft" style={{ left: `${regionDraft.x}%`, top: `${regionDraft.y}%`, width: `${regionDraft.width}%`, height: `${regionDraft.height}%` }} />}
        </div>}
        {pendingRegion && <><i className="slide-region-box" style={{ left: `${pendingRegion.x}%`, top: `${pendingRegion.y}%`, width: `${pendingRegion.width}%`, height: `${pendingRegion.height}%` }} /><button className="region-ai-button" style={{ left: `${Math.min(88, pendingRegion.x + pendingRegion.width / 2)}%`, top: `${Math.min(88, pendingRegion.y + pendingRegion.height)}%` }} onClick={openRegionQuestion}>✦ Hỏi AI về vùng này</button></>}
        {!interactionMode && <div className="slide-wheel-hint">Cuộn để đổi trang</div>}
        {anchor && <div className={`slide-context-composer ${interactionMode}`} style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }} onPointerDown={(event) => event.stopPropagation()}>
          <header className="composer-drag-handle" onPointerDown={beginComposerDrag} onPointerMove={moveComposer} onPointerUp={endComposerDrag} onPointerCancel={endComposerDrag}><span>✦ Hỏi AI về mục này <small>kéo để di chuyển</small></span><button onPointerDown={(event) => event.stopPropagation()} onClick={() => setAnchor(null)}>×</button></header>
            <textarea autoFocus value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ví dụ: Khái niệm này nghĩa là gì?" onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submitQuestion(); }} />
            <button className="context-primary" disabled={!question.trim() || asking} onClick={submitQuestion}>{asking ? 'AI đang đọc slide…' : 'Gửi câu hỏi'}</button>
            {aiError && <p className="slide-ai-error">{aiError}</p>}
            {answer && <div className="slide-ai-answer"><b>AI giải thích</b><p>{answer}</p></div>}
        </div>}
      </div>

      <aside className="pdf-sidecar">
        <div className="inline-note-card pdf-note-card">
          <div><span><i>✎</i> Ghi chú trang {page}</span><small>{note.trim() ? `${note.trim().split(/\s+/).length} từ` : 'Chưa có ghi chú'}</small></div>
          <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="Ghi lại điều bạn hiểu, một ví dụ hoặc phần còn thắc mắc ở trang này…" />
          <div className="pdf-understanding"><button className={status === 'understood' ? 'active' : ''} onClick={() => changeUnderstanding('understood')}>✓ Đã hiểu</button><button className={status === 'question' ? 'active question' : ''} onClick={() => changeUnderstanding('question')}>? Chưa rõ</button><button onClick={onAskCommunity}>Hỏi cộng đồng →</button></div>
          <div className="inline-ai-status"><i>{isThinking ? '✦' : mapSource === 'fallback' ? '!' : hasMapContent ? '✓' : '·'}</i><span>{isThinking ? 'AI đang cập nhật sơ đồ…' : mapSource === 'ai' && hasMapContent ? 'Đã đồng bộ vào sơ đồ' : hasMapContent ? 'Sơ đồ cập nhật từ ghi chú' : 'Sơ đồ chờ ghi chú đầu tiên'}</span></div>
        </div>
        <div className="inline-map-card pdf-mini-map"><header><div><span>Mind map đang hình thành</span><small>{map.nodes.length} ý · {map.edges.length} liên kết</small></div><button onClick={onOpenMap}>Mở rộng ↗</button></header><div className="mini-flow">{map.nodes.length ? <KnowledgeFlow compact map={map} accent={accent} onSelect={onOpenMap} /> : <div className="mini-map-empty"><i>✦</i><span>Ghi chú để tạo nhánh đầu tiên</span></div>}</div></div>
      </aside>

      <footer className="pdf-filmstrip"><button disabled={page === 1} onClick={() => onPageChange(page - 1)}>← Trang trước</button><input type="range" min="1" max={pageCount} value={page} onChange={(event) => onPageChange(Number(event.target.value))} /><button disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>Trang tiếp →</button></footer>
    </section>
  );
}
