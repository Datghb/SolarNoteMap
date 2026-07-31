export function resolveRestoredLessonId(
  currentLessonId: string | null,
  storedLessonId: string | null,
  visibleLessonIds: string[],
) {
  const visibleIds = new Set(visibleLessonIds);
  if (currentLessonId && visibleIds.has(currentLessonId)) return currentLessonId;
  if (storedLessonId && visibleIds.has(storedLessonId)) return storedLessonId;
  return null;
}

export function getLessonSessionKey(classId: string) {
  return `solar-open-lesson:${classId}`;
}
