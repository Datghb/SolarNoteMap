export function getLessonTitleFromPdfName(fileName: string) {
  return fileName.trim().replace(/\.pdf$/i, '').trim().slice(0, 120);
}
