import { describe, expect, it } from 'vitest';
import {
  canonicalQuizTarget,
  mergeRegeneratedQuestions,
  rankQuizEvidence,
  scoreQuizAnswers,
  serializePublicQuiz,
  validateQuizDraft,
  validateVerifierReview,
} from './adaptiveQuiz.mjs';

const evidence = [
  { id: 'chunk-10', slideNumber: 10, title: 'Token', content: 'Token là đơn vị văn bản.', summary: 'Token dùng để tính context.', keywords: ['Token'] },
  { id: 'chunk-12', slideNumber: 12, title: 'Context Window', content: 'Context Window là tổng số token mô hình có thể xử lý.', summary: 'Context Window có giới hạn.', keywords: ['Context Window'] },
  { id: 'chunk-13', slideNumber: 13, title: 'Chi phí', content: 'Chi phí API phụ thuộc input và output token.', summary: 'Token ảnh hưởng chi phí.', keywords: ['Token'] },
];

function question(slotId, keyword = 'Context Window') {
  return {
    slotId,
    question: `Câu hỏi hợp lệ cho ${slotId} là gì?`,
    options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
    correctIndex: 1,
    explanation: 'Lựa chọn B được hỗ trợ trực tiếp bởi evidence.',
    keyword,
    sourceChunkIds: ['chunk-12'],
    sourceSlides: [12],
    level: slotId === 'q1' ? 'recall' : slotId === 'q2' ? 'relationship' : 'application',
  };
}

describe('adaptive quiz retrieval', () => {
  it('prioritizes unclear slides and exact keywords deterministically', () => {
    const ranked = rankQuizEvidence({ chunks: evidence, targetKeywords: ['Context Window'], targetSlides: [12], unclearSlides: [12] });
    expect(ranked[0]).toMatchObject({ id: 'chunk-12', slideNumber: 12 });
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('creates a stable target signature independent of keyword order/casing', () => {
    expect(canonicalQuizTarget({ sourceIdentity: 'pdf:v1', targetKeywords: ['Token', 'CONTEXT Window'], targetSlides: [13, 12] }))
      .toBe(canonicalQuizTarget({ sourceIdentity: 'pdf:v1', targetKeywords: ['context window', 'token'], targetSlides: [12, 13] }));
    expect(canonicalQuizTarget({ sourceIdentity: 'pdf:v1', targetKeywords: ['token'], targetSlides: [12], difficulty: 'groq:model-a' }))
      .not.toBe(canonicalQuizTarget({ sourceIdentity: 'pdf:v1', targetKeywords: ['token'], targetSlides: [12], difficulty: 'kira:model-b' }));
  });
});

describe('adaptive quiz validation', () => {
  it('accepts a grounded three-question draft and removes answers from the public shape', () => {
    const questions = validateQuizDraft({ questions: ['q1', 'q2', 'q3'].map((slot) => question(slot)) }, { evidence, allowedKeywords: ['Context Window'] });
    expect(questions).toHaveLength(3);
    expect(serializePublicQuiz(questions)[0]).not.toHaveProperty('correctIndex');
    expect(serializePublicQuiz(questions)[0]).not.toHaveProperty('explanation');
  });

  it('rejects duplicate options and citations outside retrieved evidence', () => {
    const duplicate = question('q1');
    duplicate.options[1] = duplicate.options[0];
    expect(() => validateQuizDraft({ questions: [duplicate, question('q2'), question('q3')] }, { evidence, allowedKeywords: ['Context Window'] })).toThrow(/trùng/);
    const outside = question('q1');
    outside.sourceChunkIds = ['other-lesson-chunk'];
    expect(() => validateQuizDraft({ questions: [outside, question('q2'), question('q3')] }, { evidence, allowedKeywords: ['Context Window'] })).toThrow(/chunk/);
    const mismatchedSlide = question('q1');
    mismatchedSlide.sourceSlides = [13];
    expect(() => validateQuizDraft({ questions: [mismatchedSlide, question('q2'), question('q3')] }, { evidence, allowedKeywords: ['Context Window'] })).toThrow(/không khớp/);
    const wrongLevel = question('q1');
    wrongLevel.level = 'application';
    expect(() => validateQuizDraft({ questions: [wrongLevel, question('q2'), question('q3')] }, { evidence, allowedKeywords: ['Context Window'] })).toThrow(/cognitive level/);
  });

  it('keeps passed questions while replacing only failed slots', () => {
    const current = ['q1', 'q2', 'q3'].map((slot) => question(slot));
    const replacement = { ...question('q2'), question: 'Câu hỏi q2 đã được tạo lại hợp lệ?' };
    const merged = mergeRegeneratedQuestions(current, [replacement], ['q2']);
    expect(merged[0]).toBe(current[0]);
    expect(merged[1].question).toContain('tạo lại');
    expect(merged[2]).toBe(current[2]);
  });

  it('requires retry feedback and scores without exposing keys beforehand', () => {
    expect(validateVerifierReview({ items: [
      { slotId: 'q2', verdict: 'retry', issues: [{ code: 'AMBIGUOUS', message: 'Hai đáp án đúng.' }], retryInstruction: 'Viết lại một đáp án đúng.' },
    ] }, ['q2'])[0].verdict).toBe('retry');
    expect(() => validateVerifierReview({ items: [{ slotId: 'q2', verdict: 'retry', issues: [], retryInstruction: '' }] }, ['q2'])).toThrow(/retry/);
    const result = scoreQuizAnswers(['q1', 'q2', 'q3'].map((slot) => question(slot)), [1, 0, 1]);
    expect(result.score).toBe(2);
    expect(result.items[1].correct).toBe(false);
  });
});
