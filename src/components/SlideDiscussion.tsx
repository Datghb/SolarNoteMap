import { useCallback, useEffect, useMemo, useState } from 'react';
import { createCommunityAnswer, createCommunityQuestion, loadCommunityQuestions, subscribeCommunityQuestions } from '../utils/cloudClassroom';
import { questionsForSlide, type CommunityQuestion } from '../utils/communityQuestions';
import { recordStudentActivity } from '../utils/courseStore';
import { shouldSubmitOnEnter } from '../utils/submitOnEnter';

export function SlideDiscussion({ classId, lessonId, slideId, slideNumber }: {
  classId: string;
  lessonId: string;
  slideId: string;
  slideNumber: number;
}) {
  const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
  const [message, setMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommunityQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const loaded = await loadCommunityQuestions(classId, lessonId);
    setQuestions(loaded);
  }, [classId, lessonId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setReplyingTo(null);
    setMessage('');
    loadCommunityQuestions(classId, lessonId)
      .then((loaded) => { if (active) setQuestions(loaded); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải trò chuyện.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [classId, lessonId, slideId]);

  useEffect(() => subscribeCommunityQuestions(lessonId, () => {
    void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : 'Không thể đồng bộ trò chuyện.'));
  }), [lessonId, refresh]);

  const visibleQuestions = useMemo(() => questionsForSlide(questions, slideId), [questions, slideId]);

  const submit = async () => {
    const content = message.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      if (replyingTo) {
        await createCommunityAnswer(replyingTo.id, content);
        recordStudentActivity({ lessonId, slideId, type: 'answer_posted' });
      } else {
        await createCommunityQuestion(classId, lessonId, slideId, content);
        recordStudentActivity({ lessonId, slideId, type: 'question_posted' });
      }
      setMessage('');
      setReplyingTo(null);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể gửi tin nhắn.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="slide-discussion" aria-label={`Trò chuyện về slide ${slideNumber}`}>
      <header><div><span>◌ Trò chuyện slide {slideNumber}</span><small>{visibleQuestions.length} thảo luận</small></div></header>
      <div className="slide-chat-messages">
        {loading && <p className="slide-chat-state">Đang tải trò chuyện…</p>}
        {!loading && visibleQuestions.length === 0 && <p className="slide-chat-state">Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện về slide này.</p>}
        {visibleQuestions.map((question) => <article key={question.id}>
          <div className="slide-chat-author"><i>{question.author.charAt(0)}</i><b>{question.author}</b></div>
          <p>{question.content}</p>
          {question.answers.map((answer) => <div className="slide-chat-reply" key={answer.id}><b>{answer.author}</b><span>{answer.content}</span></div>)}
          <button onClick={() => setReplyingTo(question)}>Phản hồi</button>
        </article>)}
      </div>
      {error && <p className="slide-chat-error">{error}</p>}
      {replyingTo && <div className="slide-chat-replying"><span>Đang trả lời {replyingTo.author}</span><button onClick={() => setReplyingTo(null)}>×</button></div>}
      <div className="slide-chat-composer">
        <textarea maxLength={20000} value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => {
          if (shouldSubmitOnEnter({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing }) && message.trim() && !submitting) {
            event.preventDefault();
            void submit();
          }
        }} placeholder={replyingTo ? 'Viết phản hồi…' : 'Hỏi hoặc chia sẻ về slide này…'} />
        <button disabled={!message.trim() || submitting} onClick={() => void submit()}>{submitting ? '…' : 'Gửi'}</button>
      </div>
    </section>
  );
}
