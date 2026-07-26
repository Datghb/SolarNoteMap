import { describe, expect, it } from 'vitest';
import { addAnswer, createQuestion, toggleQuestionVote } from './communityQuestions';

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
});
