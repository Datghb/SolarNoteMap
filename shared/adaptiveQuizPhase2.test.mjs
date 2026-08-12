import { describe, expect, it } from 'vitest';
import {
  batchCoveragePlan, buildQuizCoveragePlan, createBm25Index, duplicateQuestionSlots,
  phase2SlotIds, resolvePhase2QuizRequest, searchBm25Index, tokenizeVietnamese,
} from './adaptiveQuizPhase2.mjs';

const chunks = [
  { id: 'a', slideNumber: 1, title: 'Token', content: 'Token là đơn vị văn bản của mô hình.', summary: '', keywords: ['Token'] },
  { id: 'b', slideNumber: 2, title: 'Transformer', content: 'Self-Attention là cơ chế cốt lõi của Transformer.', summary: '', keywords: ['Self-Attention'] },
  { id: 'c', slideNumber: 3, title: 'Chi phí', content: 'Chi phí API phụ thuộc số token đầu vào.', summary: '', keywords: ['API'] },
];

describe('adaptive quiz Phase 2', () => {
  it('keeps Phase 1 at three questions unless Phase 2 is explicitly enabled', () => {
    expect(resolvePhase2QuizRequest({ enabled: false, quizMode: 'lesson_review', questionCount: 15 })).toEqual({ quizMode: 'micro', questionCount: 3, requestedQuestionCount: 3 });
    expect(resolvePhase2QuizRequest({ enabled: true, quizMode: 'micro', questionCount: 5 }).questionCount).toBe(5);
    expect(resolvePhase2QuizRequest({ enabled: true, quizMode: 'lesson_review', questionCount: 10 }).questionCount).toBe(10);
    expect(() => resolvePhase2QuizRequest({ enabled: true, quizMode: 'micro', questionCount: 10 })).toThrow(/Micro-quiz/);
  });

  it('creates q1 through q15 and deterministic coverage distributions', () => {
    expect(phase2SlotIds(15)).toHaveLength(15);
    const plan = buildQuizCoveragePlan({ questionCount: 10, targetKeywords: ['Token', 'Transformer'], evidence: chunks });
    expect(plan.filter((slot) => slot.level === 'recall')).toHaveLength(4);
    expect(plan.filter((slot) => slot.level === 'relationship')).toHaveLength(3);
    expect(plan.filter((slot) => slot.level === 'application')).toHaveLength(3);
    expect(batchCoveragePlan(plan)).toHaveLength(2);
  });

  it('ranks lexical evidence with BM25 and auditable behavior boosts', () => {
    expect(tokenizeVietnamese('Self-Attention và Transformer')).toEqual(['self', 'attention', 'transformer']);
    const result = searchBm25Index(createBm25Index(chunks), { queryTerms: ['Self-Attention'], unclearSlides: [2] });
    expect(result[0]).toMatchObject({ id: 'b', slideNumber: 2, retrievalVersion: 'bm25-v1' });
    expect(result[0].bm25Score).toBeGreaterThan(0);
    expect(result[0].behaviorBoost).toBe(2);
  });

  it('diversifies lesson review evidence across the deck without embeddings', () => {
    const lessonChunks = Array.from({ length: 12 }, (_, index) => ({
      id: `c${index + 1}`, slideNumber: index + 1, title: `Chủ đề ${index + 1}`,
      content: index === 5 ? 'Transformer attention attention' : `Nội dung slide ${index + 1}`,
      summary: '', keywords: index === 5 ? ['attention'] : [],
    }));
    const result = searchBm25Index(createBm25Index(lessonChunks), {
      queryTerms: ['attention'], targetSlides: [6], currentSlide: 6, maxChunks: 6, diversifyAcrossLesson: true,
    });
    expect(result[0].slideNumber).toBe(6);
    expect(Math.max(...result.map((chunk) => chunk.slideNumber)) - Math.min(...result.map((chunk) => chunk.slideNumber))).toBeGreaterThan(5);
  });

  it('detects duplicate questions across batches', () => {
    expect(duplicateQuestionSlots([
      { slotId: 'q1', question: 'Token là gì?', options: ['a', 'b', 'c', 'd'] },
      { slotId: 'q2', question: ' Token là gì? ', options: ['a', 'b', 'c', 'd'] },
    ])).toEqual(['q2']);
  });
});
