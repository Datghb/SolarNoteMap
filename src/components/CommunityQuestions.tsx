import { useEffect, useMemo, useState } from 'react';
import type { Lesson } from '../data/lessons';
import type { LessonSlide } from '../data/slides';
import { addAnswer, createQuestion, toggleQuestionVote, type CommunityQuestion } from '../utils/communityQuestions';

function sampleQuestions(lessonId: string, slides: LessonSlide[]): CommunityQuestion[] {
  const first = slides[0];
  const second = slides[Math.min(1, slides.length - 1)];
  return [
    { id: `${lessonId}-sample-1`, lessonId, slideId: first.id, author: 'Minh Anh', content: `Mình vẫn chưa rõ ví dụ nào thể hiện đúng nhất ý “${first.title}”?`, createdAt: new Date(Date.now() - 18 * 60_000).toISOString(), votes: 6, voted: false, answers: [
      { id: 'sample-answer-1', author: 'Thảo Linh', content: 'Mình thử liên hệ với một ứng dụng dùng hằng ngày rồi chỉ ra đầu vào và kết quả của nó.', createdAt: new Date(Date.now() - 9 * 60_000).toISOString() },
    ] },
    { id: `${lessonId}-sample-2`, lessonId, slideId: second.id, author: 'Gia Huy', content: second.question, createdAt: new Date(Date.now() - 52 * 60_000).toISOString(), votes: 3, voted: false, answers: [] },
  ];
}

export function CommunityQuestions({ lesson, slides, initialSlideId, onOpenSlide }: {
  lesson: Lesson;
  slides: LessonSlide[];
  initialSlideId?: string;
  onOpenSlide: (slideId: string) => void;
}) {
  const storageKey = `solar-community-questions:${lesson.id}`;
  const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
  const [filter, setFilter] = useState(initialSlideId ?? 'all');
  const [composerSlide, setComposerSlide] = useState(initialSlideId ?? slides[0].id);
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    try {
      setQuestions(stored ? JSON.parse(stored) : sampleQuestions(lesson.id, slides));
    } catch {
      setQuestions(sampleQuestions(lesson.id, slides));
    }
    setFilter(initialSlideId ?? 'all');
    setComposerSlide(initialSlideId ?? slides[0].id);
  }, [lesson.id, initialSlideId]);

  const save = (next: CommunityQuestion[]) => {
    setQuestions(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const visible = useMemo(() => questions.filter((question) => filter === 'all' || question.slideId === filter), [filter, questions]);
  const submitQuestion = () => {
    if (!questionText.trim()) return;
    save([createQuestion(lesson.id, composerSlide, questionText, 'Anh Nguyen'), ...questions]);
    setQuestionText('');
    setFilter(composerSlide);
  };
  const submitAnswer = (questionId: string) => {
    const content = answerText[questionId]?.trim();
    if (!content) return;
    save(addAnswer(questions, questionId, content, 'Anh Nguyen'));
    setAnswerText((current) => ({ ...current, [questionId]: '' }));
  };

  return (
    <section className="question-community">
      <header className="community-header">
        <div><span className="eyebrow">Không gian thảo luận</span><h3>Hỏi để hiểu sâu hơn.</h3><p>Mỗi câu hỏi được gắn với slide nơi nó xuất hiện, để mọi người cùng nhìn một ngữ cảnh.</p></div>
        <div><b>{questions.length}</b><span>Câu hỏi trong bài</span></div>
      </header>

      <aside className="question-filters">
        <span>Trong bài giảng</span>
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}><i>◎</i><span>Tất cả câu hỏi<small>{questions.length} thảo luận</small></span></button>
        {slides.map((slide, index) => {
          const count = questions.filter((question) => question.slideId === slide.id).length;
          return <button key={slide.id} className={filter === slide.id ? 'active' : ''} onClick={() => setFilter(slide.id)}><i>{index + 1}</i><span>{slide.title}<small>{count} câu hỏi</small></span></button>;
        })}
      </aside>

      <main className="question-feed">
        <div className="feed-heading"><span>{filter === 'all' ? 'Tất cả thảo luận' : slides.find((slide) => slide.id === filter)?.title}</span><small>Mới nhất trước</small></div>
        {visible.length === 0 && <div className="empty-questions"><i>?</i><b>Chưa có câu hỏi ở slide này</b><p>Hãy mở đầu cuộc thảo luận bằng điều bạn đang chưa rõ.</p></div>}
        {visible.map((question) => {
          const slide = slides.find((item) => item.id === question.slideId)!;
          return <article className="question-thread" key={question.id}>
            <div className="question-vote"><button className={question.voted ? 'active' : ''} onClick={() => save(toggleQuestionVote(questions, question.id))}>↑</button><b>{question.votes}</b><span>quan tâm</span></div>
            <div className="question-body">
              <button className="slide-reference" onClick={() => onOpenSlide(question.slideId)}>Slide {slides.indexOf(slide) + 1} · {slide.title} ↗</button>
              <h4>{question.content}</h4>
              <div className="question-meta"><span className="community-avatar">{question.author.charAt(0)}</span><b>{question.author}</b><span>đã hỏi gần đây</span></div>
              {question.answers.length > 0 && <div className="answer-list">{question.answers.map((answer) => <div key={answer.id}><span className="community-avatar">{answer.author.charAt(0)}</span><div><b>{answer.author}</b><p>{answer.content}</p></div></div>)}</div>}
              <div className="answer-composer"><input value={answerText[question.id] ?? ''} onChange={(event) => setAnswerText((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Chia sẻ cách bạn hiểu hoặc đặt câu hỏi ngược lại…" /><button disabled={!answerText[question.id]?.trim()} onClick={() => submitAnswer(question.id)}>Phản hồi</button></div>
            </div>
          </article>;
        })}
      </main>

      <aside className="ask-panel">
        <span className="ai-kicker"><i>?</i> Câu hỏi mới</span>
        <h3>Bạn đang vướng ở đâu?</h3>
        <p>Mô tả điều bạn đã hiểu trước, rồi nói rõ phần khiến bạn băn khoăn.</p>
        <label>Đang hỏi về</label>
        <select value={composerSlide} onChange={(event) => setComposerSlide(event.target.value)}>{slides.map((slide, index) => <option key={slide.id} value={slide.id}>Slide {index + 1} · {slide.title}</option>)}</select>
        <textarea value={questionText} onChange={(event) => setQuestionText(event.target.value)} placeholder="Ví dụ: Mình hiểu dữ liệu là nguồn để AI học, nhưng chưa rõ vì sao dữ liệu lệch lại khiến dự đoán thiếu công bằng…" />
        <div className="asking-tip"><i>✦</i><span>Câu hỏi tốt có ngữ cảnh và chỉ ra chính xác điều bạn chưa hiểu.</span></div>
        <button className="publish-question" disabled={!questionText.trim()} onClick={submitQuestion}>Đăng câu hỏi <span>→</span></button>
      </aside>
    </section>
  );
}
