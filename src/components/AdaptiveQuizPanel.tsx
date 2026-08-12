import { useEffect, useState } from 'react';
import type { AdaptiveQuizRecommendation, AdaptiveQuizResult, QuizSlotId } from '../utils/adaptiveQuiz';

const levelLabels = {
  recall: 'Ghi nhớ',
  relationship: 'Liên hệ',
  application: 'Vận dụng',
} as const;

export function AdaptiveQuizPanel({
  recommendation,
  result,
  submitting,
  error,
  onSubmit,
  onContinue,
  onOpenSlide,
  onReport,
  historyMode = false,
}: {
  recommendation: AdaptiveQuizRecommendation;
  result: AdaptiveQuizResult | null;
  submitting: boolean;
  error: string;
  onSubmit: (answers: number[]) => Promise<void>;
  onContinue: () => void;
  onOpenSlide: (slideNumber: number) => void;
  onReport: (slotId: QuizSlotId) => Promise<void>;
  historyMode?: boolean;
}) {
  const [answers, setAnswers] = useState<Array<number | null>>([null, null, null]);
  const [reportedSlots, setReportedSlots] = useState<Set<QuizSlotId>>(new Set());

  useEffect(() => {
    setAnswers(result ? result.items.map((item) => item.selectedIndex) : [null, null, null]);
    setReportedSlots(new Set());
  }, [recommendation.id, result]);

  const complete = answers.every((answer) => answer !== null);
  const feedbackBySlot = new Map(result?.items.map((item) => [item.slotId, item]));

  const report = async (slotId: QuizSlotId) => {
    if (reportedSlots.has(slotId)) return;
    try {
      await onReport(slotId);
      setReportedSlots((current) => new Set([...current, slotId]));
    } catch {
      // The parent exposes the API error in the shared quiz error area.
    }
  };

  return <section className="adaptive-quiz-panel" aria-labelledby="adaptive-quiz-title">
    <header className="adaptive-quiz-header">
      <div><span>{historyMode ? 'Lịch sử micro-quiz · 3 câu' : '✦ AI micro-quiz · 3 câu'}</span><h3 id="adaptive-quiz-title">{recommendation.title}</h3></div>
      {result ? <strong>{result.score}/3 đúng</strong> : <small>Dựa trên phần bạn vừa tương tác</small>}
    </header>

    {result && <div className={`adaptive-quiz-score ${result.score === 3 ? 'perfect' : ''}`} role="status">
      <b>{result.score === 3 ? 'Bạn đã nắm chắc phần này.' : `Bạn trả lời đúng ${result.score}/3 câu.`}</b>
      <span>{result.score === 3 ? 'Bạn có thể tiếp tục bài học.' : 'Xem giải thích và quay lại slide nguồn để củng cố.'}</span>
    </div>}

    <div className="adaptive-quiz-questions">
      {recommendation.questions.map((question, questionIndex) => {
        const feedback = feedbackBySlot.get(question.slotId);
        return <article className={`adaptive-quiz-question ${feedback ? feedback.correct ? 'correct' : 'incorrect' : ''}`} key={question.slotId}>
          <div className="adaptive-question-meta"><span>Câu {questionIndex + 1}</span><small>{levelLabels[question.level]} · {question.keyword}</small></div>
          <h4>{question.question}</h4>
          <fieldset disabled={submitting || Boolean(result)}>
            <legend className="sr-only">Chọn một đáp án</legend>
            {question.options.map((option, optionIndex) => {
              const selected = answers[questionIndex] === optionIndex;
              const isCorrectAnswer = feedback?.correctIndex === optionIndex;
              const isWrongSelection = Boolean(feedback && selected && !feedback.correct);
              return <label className={`${selected ? 'selected' : ''} ${isCorrectAnswer ? 'answer-correct' : ''} ${isWrongSelection ? 'answer-wrong' : ''}`} key={optionIndex}>
                <input
                  type="radio"
                  name={`${recommendation.id}-${question.slotId}`}
                  checked={selected}
                  onChange={() => setAnswers((current) => current.map((answer, index) => index === questionIndex ? optionIndex : answer))}
                />
                <i>{String.fromCharCode(65 + optionIndex)}</i><span>{option}</span>
              </label>;
            })}
          </fieldset>
          {feedback && <div className="adaptive-answer-feedback">
            <b>{feedback.correct ? '✓ Chính xác' : 'Đáp án cần xem lại'}</b>
            <p><strong>Giải thích:</strong> {feedback.explanation}</p>
            <small className="adaptive-source-citation">Trích nguồn: {feedback.sourceSlides.map((slide) => `Slide ${slide}`).join(', ')}</small>
            <div>
              {feedback.sourceSlides.map((slide) => <button key={slide} onClick={() => onOpenSlide(slide)}>Mở slide {slide} →</button>)}
              {!historyMode && <button className="report-question" disabled={reportedSlots.has(question.slotId)} onClick={() => void report(question.slotId)}>{reportedSlots.has(question.slotId) ? 'Đã báo cáo' : 'Báo câu chưa phù hợp'}</button>}
            </div>
          </div>}
        </article>;
      })}
    </div>

    {error && <p className="adaptive-quiz-error" role="alert">{error}</p>}
    {!result && <footer className="adaptive-quiz-submit">
      <span>{complete ? 'Đã chọn đủ 3 đáp án' : `Còn ${answers.filter((answer) => answer === null).length} câu chưa chọn`}</span>
      <button disabled={!complete || submitting} onClick={() => void onSubmit(answers as number[])}>{submitting ? 'Đang chấm…' : 'Nộp bài'}</button>
    </footer>}
    {result && <footer className="adaptive-quiz-submit">
      <span>{historyMode ? 'Đây là kết quả đã lưu của lượt quiz này.' : 'Quiz tiếp theo chỉ xuất hiện khi có context học mới và hết cooldown.'}</span>
      <button onClick={onContinue}>{historyMode ? 'Quay lại bài học' : 'Tiếp tục bài học'}</button>
    </footer>}
  </section>;
}
