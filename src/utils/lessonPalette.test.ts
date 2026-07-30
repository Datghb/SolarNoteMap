import { describe, expect, it } from "vitest";
import { resolveLessonPalette, resolveLessonPalettes } from "./lessonPalette";

describe("resolveLessonPalette", () => {
  it("keeps the canonical palette for built-in lessons loaded with cloud ids", () => {
    expect(resolveLessonPalette("cloud-id", "AI Foundations", "AI là gì?")).toEqual({
      color: "#ffb547",
      colors: ["#ffe08a", "#ff9d3d", "#7c3118"],
    });
  });

  it("returns a stable palette for a custom lesson", () => {
    const first = resolveLessonPalette("custom-42", "Prompt Engineering", "Prompt căn bản");
    const second = resolveLessonPalette("custom-42", "Prompt Engineering", "Prompt căn bản");

    expect(first).toEqual(second);
    expect(first.colors).toContain(first.color);
  });

  it("assigns distinct colors to neighboring custom lessons", () => {
    const palettes = resolveLessonPalettes([
      { id: "lesson-a", shortName: "Xác định bài toán", name: "Bài toán kinh doanh" },
      { id: "lesson-b", shortName: "Agentic", name: "Agentic AI" },
      { id: "lesson-c", shortName: "LLM foundation", name: "LLM foundation" },
    ]);

    expect(new Set(palettes.map((palette) => palette.color)).size).toBe(3);
  });
});
