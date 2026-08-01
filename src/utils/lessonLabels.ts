export function getPdfLessonLabel(lessonName: string) {
  const day = lessonName.match(/\bday\s*\d+\b/i)?.[0].replace(/\s+/g, ' ').toUpperCase();
  return `${day ?? 'BÀI HỌC'} · PDF`;
}
