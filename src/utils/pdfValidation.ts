import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { isPdfPasswordError } from './pdfAccess';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function assertPdfCanOpen(file: File) {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const document = await task.promise;
    await document.destroy();
  } catch (error) {
    await task.destroy().catch(() => undefined);
    if (isPdfPasswordError(error)) {
      throw new Error('PDF đang được bảo vệ bằng mật khẩu. Hãy tải lên bản PDF không đặt mật khẩu.');
    }
    throw new Error('Không thể đọc tệp PDF. Hãy kiểm tra lại tài liệu trước khi tải lên.');
  }
}
