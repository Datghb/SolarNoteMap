import { describe, expect, it } from 'vitest';
import { addAnswer, createQuestion, orderSlidesByQuestionPresence, questionsForSlide, toggleQuestionVote } from './communityQuestions';

describe('community questions', () => {
  it('creates a question linked to a lesson slide', () => {
    const question = createQuestion('ai-foundations', 'learning-loop', 'Vì sao dữ liệu lệch làm AI sai?', 'Anh Nguyen');

    expect(question).toMatchObject({ lessonId: 'ai-foundations', slideId: 'learning-loop', votes: 0 });
    expect(question.content).toContain('dữ liệu');
  });

  it('adds answers and toggles votes immutably', () => {
    const question = createQuestion('ai-foundations', 'learning-loop', 'Mô hình học như thế nào?', 'Anh Nguyen');
    const answered = addAnswer([question], question.id, 'Mô hình điều chỉnh để giảm sai số.', 'Minh Anh');
    const voted = toggleQuestionVote(answered, question.id);

    expect(question.answers).toHaveLength(0);
    expect(voted[0].answers).toHaveLength(1);
    expect(voted[0]).toMatchObject({ votes: 1, voted: true });
    expect(toggleQuestionVote(voted, question.id)[0]).toMatchObject({ votes: 0, voted: false });
  });

  it('places slides with questions first while preserving their original order', () => {
    const slides = [{ id: 'slide-1' }, { id: 'slide-2' }, { id: 'slide-3' }, { id: 'slide-4' }];
    const questions = [{ slideId: 'slide-3' }, { slideId: 'slide-2' }, { slideId: 'slide-3' }];
    expect(orderSlidesByQuestionPresence(slides, questions).map((slide) => slide.id)).toEqual(['slide-2', 'slide-3', 'slide-1', 'slide-4']);
    expect(slides.map((slide) => slide.id)).toEqual(['slide-1', 'slide-2', 'slide-3', 'slide-4']);
  });

  it('keeps the inline chat scoped to the current slide', () => {
    const questions = [
      { id: 'q1', slideId: 'slide-1', createdAt: '2026-08-02T08:00:00.000Z' },
      { id: 'q2', slideId: 'slide-2', createdAt: '2026-08-02T09:00:00.000Z' },
      { id: 'q3', slideId: 'slide-1', createdAt: '2026-08-02T10:00:00.000Z' },
    ];

    expect(questionsForSlide(questions, 'slide-1').map((question) => question.id)).toEqual(['q1', 'q3']);
    expect(questions.map((question) => question.id)).toEqual(['q1', 'q2', 'q3']);
  });
});
