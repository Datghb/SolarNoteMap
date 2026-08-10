import { describe, expect, it } from 'vitest';
import { parseAdaptiveQuizRecommendation } from './adaptiveQuiz';

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
