export interface CommunityAnswer {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface CommunityQuestion {
  id: string;
  lessonId: string;
  slideId: string;
  author: string;
  content: string;
  createdAt: string;
  votes: number;
  voted: boolean;
  answers: CommunityAnswer[];
}

export function createQuestion(lessonId: string, slideId: string, content: string, author: string): CommunityQuestion {
  return {
    id: crypto.randomUUID(),
    lessonId,
    slideId,
    author,
    content: content.trim(),
    createdAt: new Date().toISOString(),
    votes: 0,
    voted: false,
    answers: [],
  };
}

export function addAnswer(questions: CommunityQuestion[], questionId: string, content: string, author: string) {
  return questions.map((question) => question.id === questionId ? {
    ...question,
    answers: [...question.answers, {
      id: crypto.randomUUID(),
      author,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    }],
  } : question);
}

export function toggleQuestionVote(questions: CommunityQuestion[], questionId: string) {
  return questions.map((question) => question.id === questionId ? {
    ...question,
    voted: !question.voted,
    votes: question.votes + (question.voted ? -1 : 1),
  } : question);
}

export function orderSlidesByQuestionPresence<T extends { id: string }>(slides: T[], questions: Pick<CommunityQuestion, 'slideId'>[]) {
  const slidesWithQuestions = new Set(questions.map((question) => question.slideId));
  return slides
    .map((slide, originalIndex) => ({ slide, originalIndex, hasQuestions: slidesWithQuestions.has(slide.id) }))
    .sort((left, right) => Number(right.hasQuestions) - Number(left.hasQuestions) || left.originalIndex - right.originalIndex)
    .map(({ slide }) => slide);
}

export function questionsForSlide<T extends { slideId: string }>(questions: T[], slideId: string) {
  return questions.filter((question) => question.slideId === slideId);
}
