import { useEffect, useRef, useState } from 'react';
import type { Lesson } from '../data/lessons';
import { askLessonSummaryAI, fetchLessonSummary, type SummaryChatMessage } from '../utils/lessonSummary';
import { loadSummaryChat, saveSummaryChat } from '../utils/summaryChatStore';

function renderSummary(summary: string) {
  const cleanInline = (value: string) => value.replace(/\*\*/g, '');
  return summary.split('\n').map((line, index) => {
    const text = line.trim();
    if (!text) return <span key={index} className="summary-spacer" />;
    if (text === '---') return <hr key={index} />;
    if (text.startsWith('### ')) return <h4 key={index}>{cleanInline(text.slice(4))}</h4>;
    if (text.startsWith('## ')) return <h3 key={index}>{cleanInline(text.slice(3))}</h3>;
    if (text.startsWith('# ')) return <h2 key={index}>{cleanInline(text.slice(2))}</h2>;
    if (/^[-*]\s+/.test(text)) return <p key={index} className="summary-bullet">{cleanInline(text.replace(/^[-*]\s+/, ''))}</p>;
    if (/^\d+[.)]\s+/.test(text)) return <p key={index} className="summary-step">{cleanInline(text)}</p>;
    return <p key={index}>{cleanInline(text)}</p>;
  });
}

export function LessonSummary({ lesson }: { lesson: Lesson }) {
  const [summary, setSummary] = useState(lesson.summary ?? '');
  const [source, setSource] = useState<'cache' | 'generated' | null>(null);
  const [loading, setLoading] = useState(!lesson.summary);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<SummaryChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [summaryRetryToken, setSummaryRetryToken] = useState(0);
  const messagesRef = useRef<HTMLDivElement>(null);
  const chatControllerRef = useRef<AbortController | null>(null);
  const chatSaveChainRef = useRef(Promise.resolve());

  const persistMessages = (lessonId: string, nextMessages: SummaryChatMessage[]) => {
    chatSaveChainRef.current = chatSaveChainRef.current
      .catch(() => undefined)
      .then(() => saveSummaryChat(lessonId, nextMessages))
      .catch((reason) => console.error('Không đồng bộ được lịch sử hỏi đáp:', reason));
  };

  useEffect(() => {
    let active = true;
    chatControllerRef.current?.abort();
    setSummary(lesson.summary ?? '');
    setSource(lesson.summary ? 'cache' : null);
    setMessages([]);
    setQuestion('');
    setAsking(false);
    setLoading(!lesson.summary);
    setError('');
    loadSummaryChat(lesson.id).then((storedMessages) => {
      if (active) setMessages(storedMessages);
    }).catch((reason) => console.error('Không tải được lịch sử hỏi đáp:', reason));
    if (lesson.summary) return () => { active = false; chatControllerRef.current?.abort(); };
    fetchLessonSummary(lesson.id, lesson.pdfUrl).then((result) => {
      if (!active) return;
      setSummary(result.summary);
      setSource(result.source);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Không thể tạo bản tóm tắt.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; chatControllerRef.current?.abort(); };
  }, [lesson.id, lesson.pdfUrl, lesson.summary, summaryRetryToken]);

  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  const submit = async () => {
    const content = question.trim();
    if (!content || asking || !summary) return;
    const nextMessages = [...messages, { role: 'user' as const, content }];
    setMessages(nextMessages);
    persistMessages(lesson.id, nextMessages);
    setQuestion('');
    setAsking(true);
    setError('');
    const controller = new AbortController();
    chatControllerRef.current = controller;
    try {
      const answer = await askLessonSummaryAI(lesson.id, content, messages, controller.signal, lesson.pdfUrl, summary);
      if (controller.signal.aborted) return;
      const completedMessages = [...nextMessages, { role: 'assistant' as const, content: answer }];
      setMessages(completedMessages);
      persistMessages(lesson.id, completedMessages);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : 'AI chưa thể trả lời lúc này.');
    } finally {
      if (!controller.signal.aborted) setAsking(false);
    }
  };

  return <section className="lesson-summary-view">
    <div className="summary-document">
      <header><div><span>✦ Bản tóm tắt toàn bài</span><h3>{lesson.name}</h3></div><small>{loading ? 'AI đang đọc slide…' : source === 'cache' ? 'Đã lưu' : 'Vừa tạo bởi AI'}</small></header>
      {loading && <div className="summary-loading"><i /><b>AI đang tổng hợp toàn bộ slide</b><span>Kết quả sẽ được lưu để dùng cho những lần mở sau.</span></div>}
      {!loading && error && !summary && <div className="summary-error"><b>Chưa thể tải bản tóm tắt</b><span>{error}</span><button onClick={() => setSummaryRetryToken((value) => value + 1)}>Thử lại</button></div>}
      {summary && <div className="summary-copy">{renderSummary(summary)}</div>}
    </div>
    <aside className="summary-chat">
      <header><span>✦ Hỏi AI về bài học</span><small>Trả lời dựa trên nội dung slide</small></header>
      <div ref={messagesRef} className="summary-messages">
        {!messages.length && <div className="summary-chat-empty"><b>Bạn muốn làm rõ phần nào?</b><span>Ví dụ: “Giải thích LLM bằng một ví dụ đơn giản.”</span></div>}
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`summary-message ${message.role}`}><small>{message.role === 'user' ? 'Bạn' : 'AI trợ giảng'}</small><p>{message.content}</p></div>)}
        {asking && <div className="summary-message assistant thinking"><small>AI trợ giảng</small><p>Đang tìm trong nội dung bài…</p></div>}
      </div>
      {error && summary && <p className="summary-chat-error">{error}</p>}
      <div className="summary-chat-composer"><textarea value={question} disabled={!summary || asking} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={summary ? 'Hỏi bất kỳ điều gì trong bài học…' : 'Chờ AI tạo bản tóm tắt…'} /><button disabled={!question.trim() || !summary || asking} onClick={submit}>Gửi ↑</button></div>
    </aside>
  </section>;
}
