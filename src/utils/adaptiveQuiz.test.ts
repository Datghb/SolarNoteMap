import { describe, expect, it } from 'vitest';
import { parseAdaptiveQuizHistory, parseAdaptiveQuizRecommendation } from './adaptiveQuiz';

const validQuestion = (slotId: 'q1' | 'q2' | 'q3') => ({
  slotId,
  question: `Câu hỏi đủ dài cho ${slotId}?`,
  options: ['A', 'B', 'C', 'D'],
  keyword: 'Token',
  sourceSlides: [2],
  level: slotId === 'q1' ? 'recall' : slotId === 'q2' ? 'relationship' : 'application',
});

describe('parseAdaptiveQuizRecommendation', () => {
  it('accepts a safe three-question payload', () => {
    const parsed = parseAdaptiveQuizRecommendation({
      id: 'quiz-id', status: 'pending', title: 'Kiểm tra nhanh', targetKeywords: ['Token'], targetSlides: [2],
      questionCount: 3, questions: [validQuestion('q1'), validQuestion('q2'), validQuestion('q3')], recommendedAt: new Date().toISOString(), cacheHit: false,
    });
    expect(parsed?.questions).toHaveLength(3);
  });

  it('rejects an answer key before submission', () => {
    expect(() => parseAdaptiveQuizRecommendation({
      id: 'quiz-id', status: 'pending', title: 'Kiểm tra nhanh', targetKeywords: ['Token'], targetSlides: [2],
      questionCount: 3, questions: [{ ...validQuestion('q1'), correctIndex: 0 }, validQuestion('q2'), validQuestion('q3')], recommendedAt: new Date().toISOString(), cacheHit: false,
    })).toThrow(/không an toàn/);
  });
});

describe('parseAdaptiveQuizHistory', () => {
  it('accepts only completed quizzes with post-submit explanations and source slides', () => {
    const recommendation = {
      id: 'quiz-id', status: 'completed', title: 'Kiểm tra nhanh', targetKeywords: ['Token'], targetSlides: [2],
      questionCount: 3, questions: [validQuestion('q1'), validQuestion('q2'), validQuestion('q3')], recommendedAt: new Date().toISOString(), cacheHit: true,
    };
    const resultItems = ['q1', 'q2', 'q3'].map((slotId, index) => ({
      slotId, selectedIndex: index % 2, correctIndex: 0, correct: index % 2 === 0,
      explanation: 'Giải thích dựa trên nội dung slide nguồn.', sourceSlides: [2], keyword: 'Token',
    }));
    const history = parseAdaptiveQuizHistory([{
      id: 'quiz-id', recommendation,
      result: { score: 2, questionCount: 3, durationSeconds: 45, items: resultItems },
      completedAt: new Date().toISOString(),
    }]);
    expect(history[0].result.items[0]).toMatchObject({ explanation: expect.any(String), sourceSlides: [2] });
  });
});
