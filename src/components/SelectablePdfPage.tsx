import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { TextLayerBuilder } from 'pdfjs-dist/legacy/web/pdf_viewer.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/legacy/web/pdf_viewer.css';

GlobalWorkerOptions.workerSrc = workerUrl;
const slidePdfUrl = new URL('../../day01-llm-foundation.pdf', import.meta.url).href;

let documentPromise: Promise<PDFDocumentProxy> | null = null;
function loadSlides() {
  documentPromise ??= fetch(slidePdfUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Không tải được PDF (${response.status}).`);
      return response.arrayBuffer();
    })
    .then((buffer) => getDocument({ data: new Uint8Array(buffer) }).promise)
    .catch((error) => {
      documentPromise = null;
      throw error;
    });
  return documentPromise;
}

export function SelectablePdfPage({ pageNumber, onTextSelected }: { pageNumber: number; onTextSelected: (selection: { text: string; x: number; y: number }) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const textHost = textRef.current;
    if (!host || !canvas || !textHost) return;
    let cancelled = false;
    let generation = 0;
    let resizeFrame = 0;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let textLayer: TextLayerBuilder | null = null;

    const render = async (currentGeneration: number) => {
      try {
        const document = await loadSlides();
        const page = await document.getPage(pageNumber);
        if (cancelled || currentGeneration !== generation) return;
        const base = page.getViewport({ scale: 1 });
        const scale = Math.max(0.2, Math.min((host.clientWidth - 4) / base.width, (host.clientHeight - 4) / base.height));
        const viewport = page.getViewport({ scale });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        textHost.replaceChildren();
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Không thể khởi tạo trình hiển thị slide.');
        renderTask = page.render({ canvasContext: context, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
        textLayer = new TextLayerBuilder({ pdfPage: page, onAppend: (layer: HTMLDivElement) => textHost.append(layer) });
        await Promise.all([renderTask.promise, textLayer.render(viewport)]);
        if (!cancelled && currentGeneration === generation) setError('');
      } catch (renderError) {
        if (!cancelled && currentGeneration === generation && !(renderError instanceof Error && renderError.name === 'RenderingCancelledException')) {
          console.error('PDF slide rendering failed:', renderError);
          setError(renderError instanceof Error ? renderError.message : 'Không thể hiển thị nội dung slide.');
        }
      }
    };

    const scheduleRender = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        generation += 1;
        renderTask?.cancel();
        textLayer?.cancel();
        renderTask = null;
        textLayer = null;
        void render(generation);
      });
    };
    const observer = new ResizeObserver(() => {
      scheduleRender();
    });
    observer.observe(host);
    scheduleRender();
    return () => {
      cancelled = true;
      generation += 1;
      window.cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pageNumber, retryToken]);

  const captureSelection = () => {
    requestAnimationFrame(() => {
      const selection = window.getSelection();
      const host = hostRef.current;
      if (!selection || !host || selection.isCollapsed || !selection.rangeCount) return;
      const text = selection.toString().replace(/\s+/g, ' ').trim().slice(0, 1_000);
      if (!text || !textRef.current?.contains(selection.anchorNode)) return;
      const rangeBounds = selection.getRangeAt(0).getBoundingClientRect();
      const hostBounds = host.getBoundingClientRect();
      onTextSelected({
        text,
        x: ((rangeBounds.left + rangeBounds.width / 2 - hostBounds.left) / hostBounds.width) * 100,
        y: ((rangeBounds.bottom - hostBounds.top) / hostBounds.height) * 100,
      });
    });
  };

  return <div ref={hostRef} className="selectable-pdf-page" onMouseUp={captureSelection} onTouchEnd={captureSelection}>
    <div className="pdf-page-surface"><canvas ref={canvasRef} /><div ref={textRef} className="pdf-text-host" /></div>
    {error && <div className="pdf-render-error"><b>Không thể hiển thị nội dung slide</b><small>{error}</small><button onClick={() => setRetryToken((value) => value + 1)}>Thử lại</button></div>}
  </div>;
}
