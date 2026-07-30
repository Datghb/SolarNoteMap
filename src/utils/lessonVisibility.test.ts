import { describe, expect, it } from "vitest";
import type { TeacherLesson } from "./courseStore";
import { getVisibleLessons } from "./lessonVisibility";

const lessons = [
  { id: "draft", published: false },
  { id: "open", published: true },
] as TeacherLesson[];

describe("getVisibleLessons", () => {
  it("shows teachers every lesson, including drafts", () => {
    expect(getVisibleLessons(lessons, "teacher").map((lesson) => lesson.id)).toEqual([
      "draft",
      "open",
    ]);
  });

  it("shows students only published lessons", () => {
    expect(getVisibleLessons(lessons, "student").map((lesson) => lesson.id)).toEqual([
      "open",
    ]);
  });
});
