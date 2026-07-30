import type { TeacherLesson } from "./courseStore";

export function getVisibleLessons(
  lessons: TeacherLesson[],
  role: "teacher" | "student" | "admin" | undefined,
) {
  return role === "teacher"
    ? [...lessons]
    : lessons.filter((lesson) => lesson.published);
}
