import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { TextLayerBuilder } from 'pdfjs-dist/legacy/web/pdf_viewer.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/legacy/web/pdf_viewer.css';

GlobalWorkerOptions.workerSrc = workerUrl;
export const builtInSlidePdfUrl = new URL('../../day01-llm-foundation.pdf', import.meta.url).href;

const documentPromises = new Map<string, Promise<PDFDocumentProxy>>();
function loadSlides(pdfUrl: string) {
  const cached = documentPromises.get(pdfUrl);
  if (cached) return cached;
  const promise = fetch(pdfUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Không tải được PDF (${response.status}).`);
      return response.arrayBuffer();
    })
    .then((buffer) => getDocument({ data: new Uint8Array(buffer) }).promise)
    .catch((error) => {
      documentPromises.delete(pdfUrl);
      throw error;
    });
  documentPromises.set(pdfUrl, promise);
  return promise;
}

export function SelectablePdfPage({ pageNumber, pdfUrl, onDocumentLoad }: { pageNumber: number; pdfUrl: string; onDocumentLoad?: (pageCount: number) => void }) {
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
        const document = await loadSlides(pdfUrl);
        onDocumentLoad?.(document.numPages);
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
        textLayer = new TextLayerBuilder({ pdfPage: page, onAppend: ((layer: HTMLDivElement) => textHost.append(layer)) as never });
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
  }, [pageNumber, pdfUrl, onDocumentLoad, retryToken]);

  return <div ref={hostRef} className="selectable-pdf-page">
    <div className="pdf-page-surface"><canvas ref={canvasRef} /><div ref={textRef} className="pdf-text-host" /></div>
    {error && <div className="pdf-render-error"><b>Không thể hiển thị nội dung slide</b><small>{error}</small><button onClick={() => setRetryToken((value) => value + 1)}>Thử lại</button></div>}
  </div>;
}
