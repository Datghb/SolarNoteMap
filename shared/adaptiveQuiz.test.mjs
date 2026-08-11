import { describe, expect, it } from 'vitest';
import {
  canonicalQuizTarget,
  createMockQuizDraft,
  evaluateCompletedQuizPolicy,
  mergeRegeneratedQuestions,
  rankQuizEvidence,
  quizVariantMatchesMode,
  resolveQuizKnowledgeState,
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
  it('enforces completion cooldown and the per-lesson 24h cap deterministically', () => {
    const now = Date.parse('2026-08-11T10:00:00.000Z');
    expect(evaluateCompletedQuizPolicy({ completedAt: ['2026-08-11T09:58:30.000Z'], now, cooldownSeconds: 600, maxCompleted: 3 }))
      .toMatchObject({ allowed: false, reason: 'cooldown', remainingSeconds: 510 });
    expect(evaluateCompletedQuizPolicy({ completedAt: ['2026-08-11T08:00:00.000Z', '2026-08-11T07:00:00.000Z', '2026-08-11T06:00:00.000Z'], now, cooldownSeconds: 600, maxCompleted: 3 }))
      .toMatchObject({ allowed: false, reason: 'daily_limit' });
    expect(evaluateCompletedQuizPolicy({ completedAt: ['2026-08-11T08:00:00.000Z'], now, cooldownSeconds: 600, maxCompleted: 3 }))
      .toMatchObject({ allowed: true, reason: 'ready' });
  });

  it('isolates mock variants from live mode while preserving old live variants', () => {
    expect(quizVariantMatchesMode({ validation: { mode: 'mock' } }, 'live')).toBe(false);
    expect(quizVariantMatchesMode({ validation: { mode: 'mock' } }, 'mock')).toBe(true);
    expect(quizVariantMatchesMode({ validation: { mode: 'live' } }, 'mock')).toBe(false);
    expect(quizVariantMatchesMode({ validation: {} }, 'live')).toBe(true);
  });

  it('is ready with current PDF chunks even when the AI graph artifact is absent', () => {
    const state = resolveQuizKnowledgeState({
      sourceIdentity: 'lesson.pdf:2026-08-11',
      artifact: null,
      chunks: [
        { id: 'chunk-1', source_identity: 'lesson.pdf:2026-08-11', slide_number: 1 },
        { id: 'stale', source_identity: 'lesson.pdf:old', slide_number: 2 },
      ],
    });
    expect(state.ready).toBe(true);
    expect(state.chunkPages).toEqual([1]);
    expect(state.currentArtifact).toBeNull();
  });

  it('does not treat an artifact or stale chunks as a quiz knowledge index', () => {
    const state = resolveQuizKnowledgeState({
      sourceIdentity: 'lesson.pdf:new',
      artifact: { source_identity: 'lesson.pdf:new', graph: { nodes: [], edges: [] } },
      chunks: [{ id: 'stale', source_identity: 'lesson.pdf:old', slide_number: 1 }],
    });
    expect(state.ready).toBe(false);
    expect(state.currentChunks).toEqual([]);
    expect(state.currentArtifact).not.toBeNull();
  });

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
  it('creates a deterministic grounded mock quiz without an external LLM', () => {
    const questions = createMockQuizDraft({ evidence, targetKeywords: ['Context Window'] });
    expect(questions).toHaveLength(3);
    expect(questions.map((item) => item.level)).toEqual(['recall', 'relationship', 'application']);
    expect(questions.every((item) => item.question.startsWith('[MOCK]'))).toBe(true);
    expect(questions.every((item) => item.sourceChunkIds.length === 1)).toBe(true);
    expect(questions.every((item) => /Slide \d+/.test(item.explanation) && !item.explanation.includes(item.sourceChunkIds[0]))).toBe(true);
  });

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
