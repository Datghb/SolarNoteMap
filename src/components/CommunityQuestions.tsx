import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Lesson } from '../data/lessons';
import type { LessonSlide } from '../data/slides';
import { discussionsForFilter, orderSlidesByQuestionPresence, resolveDiscussionSlideId, type CommunityQuestion } from '../utils/communityQuestions';
import { recordStudentActivity } from '../utils/courseStore';
import { createCommunityAnswer, createCommunityQuestion, loadCommunityQuestions, setCommunityQuestionVote, subscribeCommunityQuestions } from '../utils/cloudClassroom';
import { shouldSubmitOnEnter } from '../utils/submitOnEnter';

export function CommunityQuestions({ lesson, classId, slides, initialSlideId, onOpenSlide }: {
  lesson: Lesson;
  classId: string;
  slides: LessonSlide[];
  initialSlideId?: string;
  onOpenSlide: (slideId: string) => void;
}) {
  const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
  const [filter, setFilter] = useState(initialSlideId ?? 'general');
  const [answerText, setAnswerText] = useState<Record<string, string>>({});
  const [questionText, setQuestionText] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const slideSignature = slides.map((slide) => slide.id).join('|');

  const refreshQuestions = useCallback(async () => {
    const loaded = await loadCommunityQuestions(classId, lesson.id);
    setQuestions(loaded);
  }, [classId, lesson.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    loadCommunityQuestions(classId, lesson.id).then((loaded) => {
      if (active) setQuestions(loaded);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải thảo luận.');
    }).finally(() => { if (active) setLoading(false); });
    setFilter(initialSlideId ?? 'general');
    return () => { active = false; };
  }, [lesson.id, classId, initialSlideId, slideSignature]);

  useEffect(() => subscribeCommunityQuestions(lesson.id, () => {
    void refreshQuestions().catch((reason) => setError(reason instanceof Error ? reason.message : 'Không thể đồng bộ thảo luận.'));
  }), [lesson.id, refreshQuestions]);

  const visible = useMemo(() => discussionsForFilter(questions, filter), [filter, questions]);
  const generalDiscussionCount = useMemo(() => questions.filter((question) => !question.slideId).length, [questions]);
  const questionCountBySlide = useMemo(() => questions.reduce<Record<string, number>>((counts, question) => ({
    ...counts,
    [question.slideId]: (counts[question.slideId] ?? 0) + 1,
  }), {}), [questions]);
  const orderedFilterSlides = useMemo(() => orderSlidesByQuestionPresence(slides, questions), [questions, slideSignature]);
  const currentQuestionText = questionText[filter] ?? '';
  const submitQuestion = async () => {
    if (!currentQuestionText.trim()) return;
    setSubmitting('question');
    setError('');
    try {
      const slideId = resolveDiscussionSlideId(filter);
      await createCommunityQuestion(classId, lesson.id, slideId, currentQuestionText);
      setQuestionText((current) => ({ ...current, [filter]: '' }));
      await refreshQuestions();
      recordStudentActivity({ lessonId: lesson.id, slideId: slideId ?? undefined, type: 'question_posted' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đăng thảo luận.');
    } finally {
      setSubmitting(null);
    }
  };
  const submitAnswer = async (questionId: string) => {
    const content = answerText[questionId]?.trim();
    if (!content) return;
    setSubmitting(`answer:${questionId}`);
    setError('');
    try {
      await createCommunityAnswer(questionId, content);
      setAnswerText((current) => ({ ...current, [questionId]: '' }));
      await refreshQuestions();
      const question = questions.find((item) => item.id === questionId);
      recordStudentActivity({ lessonId: lesson.id, slideId: question?.slideId, type: 'answer_posted' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đăng phản hồi.');
    } finally {
      setSubmitting(null);
    }
  };

  const toggleVote = async (question: CommunityQuestion) => {
    setSubmitting(`vote:${question.id}`);
    setError('');
    try {
      await setCommunityQuestionVote(question.id, !question.voted);
      await refreshQuestions();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật bình chọn.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <section className="question-community">
      <header className="community-header">
        <div><span className="eyebrow">Không gian thảo luận</span><h3>Cùng nhau trao đổi và hiểu sâu hơn.</h3><p>Mọi thành viên trong lớp có thể chia sẻ, đặt câu hỏi và trò chuyện chung hoặc theo từng slide.</p></div>
        <div><b>{questions.length}</b><span>Thảo luận trong bài</span></div>
      </header>

      <aside className="question-filters">
        <span>Trong bài giảng</span>
        <button className={filter === 'general' ? 'active' : ''} onClick={() => setFilter('general')}><i>◎</i><span>Thảo luận chung<small>{generalDiscussionCount} nội dung</small></span></button>
        {orderedFilterSlides.map((slide) => {
          const count = questionCountBySlide[slide.id] ?? 0;
          const slideNumber = slides.findIndex((item) => item.id === slide.id) + 1;
          return <button key={slide.id} className={filter === slide.id ? 'active' : ''} onClick={() => setFilter(slide.id)}><i>{slideNumber}</i><span>{slide.title}<small>{count} thảo luận</small></span></button>;
        })}
      </aside>

      <main className="question-feed">
        <div className="feed-heading">{filter === 'general'
          ? <span>Thảo luận chung</span>
          : <button type="button" className="feed-slide-link" aria-label={`Mở ${slides.find((slide) => slide.id === filter)?.title ?? 'slide'} trong bài học`} onClick={() => onOpenSlide(filter)}>{slides.find((slide) => slide.id === filter)?.title} ↗</button>}
          <small>Mới nhất trước</small>
        </div>
        {loading && <div className="community-status">Đang tải thảo luận…</div>}
        {error && <div className="community-status error"><span>{error}</span><button onClick={() => void refreshQuestions()}>Tải lại</button></div>}
        {!loading && !error && visible.length === 0 && <div className="empty-questions"><i>✦</i><b>Chưa có nội dung thảo luận</b><p>Hãy mở đầu cuộc trò chuyện bằng một chia sẻ hoặc câu hỏi.</p></div>}
        {visible.map((question) => {
          const slide = slides.find((item) => item.id === question.slideId);
          return <article className="question-thread" key={question.id}>
            <div className="question-vote"><button disabled={submitting === `vote:${question.id}`} className={question.voted ? 'active' : ''} onClick={() => void toggleVote(question)}>↑</button><b>{question.votes}</b><span>quan tâm</span></div>
            <div className="question-body">
              {slide && <button className="slide-reference" onClick={() => onOpenSlide(question.slideId)}>Slide {slides.indexOf(slide) + 1} · {slide.title} ↗</button>}
              <h4>{question.content}</h4>
              <div className="question-meta"><span className="community-avatar">{question.author.charAt(0)}</span><b>{question.author}</b><span>đã chia sẻ gần đây</span></div>
              {question.answers.length > 0 && <div className="answer-list">{question.answers.map((answer) => <div key={answer.id}><span className="community-avatar">{answer.author.charAt(0)}</span><div><b>{answer.author}</b><p>{answer.content}</p></div></div>)}</div>}
              <div className="answer-composer"><input maxLength={20000} value={answerText[question.id] ?? ''} onChange={(event) => setAnswerText((current) => ({ ...current, [question.id]: event.target.value }))} onKeyDown={(event) => { if (shouldSubmitOnEnter({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing }, false) && answerText[question.id]?.trim() && submitting !== `answer:${question.id}`) { event.preventDefault(); void submitAnswer(question.id); } }} placeholder="Chia sẻ cách bạn hiểu hoặc đặt câu hỏi ngược lại…" /><button disabled={!answerText[question.id]?.trim() || submitting === `answer:${question.id}`} onClick={() => void submitAnswer(question.id)}>Phản hồi</button></div>
            </div>
          </article>;
        })}
        <div className="community-chat-composer">
          <div><b>{filter === 'general' ? 'Thảo luận chung với cả lớp' : `Thảo luận về ${slides.find((slide) => slide.id === filter)?.title}`}</b><small>Enter để gửi · Shift + Enter để xuống dòng</small></div>
          <div><textarea maxLength={20000} value={currentQuestionText} onChange={(event) => setQuestionText((current) => ({ ...current, [filter]: event.target.value }))} onKeyDown={(event) => {
            if (shouldSubmitOnEnter({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing }) && currentQuestionText.trim() && submitting !== 'question') {
              event.preventDefault();
              void submitQuestion();
            }
          }} placeholder={filter === 'general' ? 'Chia sẻ với cả lớp…' : 'Chia sẻ hoặc đặt câu hỏi về trang này…'} /><button disabled={!currentQuestionText.trim() || submitting === 'question'} onClick={() => void submitQuestion()}>{submitting === 'question' ? 'Đang gửi…' : 'Gửi thảo luận'} <span>↑</span></button></div>
        </div>
      </main>

    </section>
  );
}
