import { useEffect, useRef, useState } from 'react';
import type { Lesson } from '../data/lessons';
import { askLessonSummaryAI, fetchLessonKeywords, fetchLessonSummary, isExtractiveFallbackSummary, type LessonKeyword, type SummaryChatMessage } from '../utils/lessonSummary';
import { extractKeywordDefinitions, isTechnicalKeywordDefinition, normalizeKeywordTerm, splitTextWithKeywords } from '../utils/summaryKeywords';
import { loadSummaryChat, saveSummaryChat } from '../utils/summaryChatStore';

function mergeKeywords(summary: string, stored: LessonKeyword[]) {
  const merged = new Map(extractKeywordDefinitions(summary).map((item) => [normalizeKeywordTerm(item.term), item]));
  for (const item of stored) {
    if (isTechnicalKeywordDefinition(item)) merged.set(normalizeKeywordTerm(item.term), item);
  }
  return [...merged.values()];
}

function HighlightedText({ text, keywords }: { text: string; keywords: LessonKeyword[] }) {
  return splitTextWithKeywords(text.replace(/\*\*/g, ''), keywords).map((part, index) => part.keyword
    ? <span key={`${part.text}-${index}`} className="summary-keyword" tabIndex={0}>
        {part.text}
        <span role="tooltip" className="summary-keyword-tooltip"><b>{part.keyword.term}</b>{part.keyword.definition}</span>
      </span>
    : <span key={`${part.text}-${index}`}>{part.text}</span>);
}

function renderSummary(summary: string, keywords: LessonKeyword[]) {
  return summary.split('\n').map((line, index) => {
    const text = line.trim();
    if (!text) return <span key={index} className="summary-spacer" />;
    if (text === '---') return <hr key={index} />;
    if (text.startsWith('### ')) return <h4 key={index}><HighlightedText text={text.slice(4)} keywords={keywords} /></h4>;
    if (text.startsWith('## ')) return <h3 key={index}><HighlightedText text={text.slice(3)} keywords={keywords} /></h3>;
    if (text.startsWith('# ')) return <h2 key={index}><HighlightedText text={text.slice(2)} keywords={keywords} /></h2>;
    if (/^[-*]\s+/.test(text)) return <p key={index} className="summary-bullet"><HighlightedText text={text.replace(/^[-*]\s+/, '')} keywords={keywords} /></p>;
    if (/^\d+[.)]\s+/.test(text)) return <p key={index} className="summary-step"><HighlightedText text={text} keywords={keywords} /></p>;
    return <p key={index}><HighlightedText text={text} keywords={keywords} /></p>;
  });
}

export function LessonSummary({ lesson, onRefreshPdf }: { lesson: Lesson; onRefreshPdf?: () => Promise<string> }) {
  const initialSummary = isExtractiveFallbackSummary(lesson.summary) ? '' : (lesson.summary ?? '');
  const [summary, setSummary] = useState(initialSummary);
  const [keywords, setKeywords] = useState<LessonKeyword[]>(() => mergeKeywords(initialSummary, []));
  const [source, setSource] = useState<'cache' | 'generated' | null>(null);
  const [loading, setLoading] = useState(!initialSummary);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<SummaryChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [summaryRetryToken, setSummaryRetryToken] = useState(0);
  const [retryPdfUrl, setRetryPdfUrl] = useState('');
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
    const storedSummary = isExtractiveFallbackSummary(lesson.summary) ? '' : (lesson.summary ?? '');
    setSummary(storedSummary);
    setKeywords(mergeKeywords(storedSummary, []));
    setSource(storedSummary ? 'cache' : null);
    setMessages([]);
    setQuestion('');
    setAsking(false);
    setLoading(!storedSummary);
    setError('');
    loadSummaryChat(lesson.id).then((storedMessages) => {
      if (active) setMessages(storedMessages);
    }).catch((reason) => console.error('Không tải được lịch sử hỏi đáp:', reason));
    fetchLessonKeywords(lesson.id).then((storedKeywords) => {
      if (active) setKeywords(mergeKeywords(storedSummary, storedKeywords));
    }).catch((reason) => console.error('Không tải được từ điển keyword:', reason));
    if (storedSummary) return () => { active = false; chatControllerRef.current?.abort(); };
    fetchLessonSummary(lesson.id, retryPdfUrl || lesson.pdfUrl, summaryRetryToken > 0 || isExtractiveFallbackSummary(lesson.summary)).then((result) => {
      if (!active) return;
      setSummary(result.summary);
      setKeywords(mergeKeywords(result.summary, result.keywords));
      setSource(result.source);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Không thể tạo bản tóm tắt.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; chatControllerRef.current?.abort(); };
  }, [lesson.id, lesson.pdfUrl, lesson.summary, retryPdfUrl, summaryRetryToken]);

  const retrySummary = async () => {
    setLoading(true);
    setError('');
    try {
      const refreshedPdfUrl = onRefreshPdf ? await onRefreshPdf() : lesson.pdfUrl;
      setRetryPdfUrl(refreshedPdfUrl ?? '');
      setSummaryRetryToken((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải lại bài giảng.');
      setLoading(false);
    }
  };

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
      {!loading && error && !summary && <div className="summary-error"><b>Chưa thể tải bản tóm tắt</b><span>{error}</span><button onClick={() => void retrySummary()}>Thử lại</button></div>}
      {summary && <div className="summary-copy">{renderSummary(summary, keywords)}</div>}
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
