import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lesson } from '../data/lessons';
import { askLessonSummaryAI, fetchLessonKeywords, fetchLessonSummary, generateLessonKeywords, isExtractiveFallbackSummary, type LessonKeyword, type SummaryChatMessage } from '../utils/lessonSummary';
import { isTechnicalKeywordDefinition, normalizeKeywordTerm, splitLinesWithFirstKeywordOccurrences, type SummaryTextPart } from '../utils/summaryKeywords';
import { loadSummaryChat, saveSummaryChat } from '../utils/summaryChatStore';
import { shouldSubmitOnEnter } from '../utils/submitOnEnter';

function mergeKeywords(_summary: string, stored: LessonKeyword[]) {
  const merged = new Map<string, LessonKeyword>();
  for (const item of stored) {
    if (isTechnicalKeywordDefinition(item)) merged.set(normalizeKeywordTerm(item.term), item);
  }
  return [...merged.values()];
}

function KeywordTerm({ text, keyword }: { text: string; keyword: LessonKeyword }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const showTooltip = () => {
    const rectangle = anchorRef.current?.getBoundingClientRect();
    if (!rectangle) return;
    const halfWidth = Math.min(160, (window.innerWidth - 24) / 2);
    setPosition({
      top: rectangle.top - 10,
      left: Math.min(window.innerWidth - halfWidth - 12, Math.max(halfWidth + 12, rectangle.left + rectangle.width / 2)),
    });
  };
  return <>
    <span
      ref={anchorRef}
      className="summary-keyword"
      tabIndex={0}
      aria-describedby={tooltipId}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setPosition(null)}
      onFocus={showTooltip}
      onBlur={() => setPosition(null)}
    >{text}</span>
    {position && createPortal(
      <span id={tooltipId} role="tooltip" className="summary-keyword-tooltip" style={{ top: position.top, left: position.left }}>
        <b>{keyword.term}</b>{keyword.definition}
      </span>,
      document.body,
    )}
  </>;
}

function HighlightedText({ parts }: { parts: SummaryTextPart[] }) {
  return parts.map((part, index) => part.keyword
    ? <KeywordTerm key={`${part.text}-${index}`} text={part.text} keyword={part.keyword} />
    : <span key={`${part.text}-${index}`}>{part.text}</span>);
}

function renderSummary(summary: string, keywords: LessonKeyword[]) {
  const parsedLines = summary.split('\n').map((line) => {
    const text = line.trim();
    if (!text) return { kind: 'spacer' as const, text: '' };
    if (text === '---') return { kind: 'rule' as const, text: '' };
    if (text.startsWith('### ')) return { kind: 'h4' as const, text: text.slice(4).replace(/\*\*/g, '') };
    if (text.startsWith('## ')) return { kind: 'h3' as const, text: text.slice(3).replace(/\*\*/g, '') };
    if (text.startsWith('# ')) return { kind: 'h2' as const, text: text.slice(2).replace(/\*\*/g, '') };
    if (/^[-*]\s+/.test(text)) return { kind: 'bullet' as const, text: text.replace(/^[-*]\s+/, '').replace(/\*\*/g, '') };
    if (/^\d+[.)]\s+/.test(text)) return { kind: 'step' as const, text: text.replace(/\*\*/g, '') };
    return { kind: 'paragraph' as const, text: text.replace(/\*\*/g, '') };
  });
  const splitLines = splitLinesWithFirstKeywordOccurrences(parsedLines.map((line) => line.text), keywords);
  return parsedLines.map((line, index) => {
    const content = <HighlightedText parts={splitLines[index]} />;
    if (line.kind === 'spacer') return <span key={index} className="summary-spacer" />;
    if (line.kind === 'rule') return <hr key={index} />;
    if (line.kind === 'h4') return <h4 key={index}>{content}</h4>;
    if (line.kind === 'h3') return <h3 key={index}>{content}</h3>;
    if (line.kind === 'h2') return <h2 key={index}>{content}</h2>;
    if (line.kind === 'bullet') return <p key={index} className="summary-bullet">{content}</p>;
    if (line.kind === 'step') return <p key={index} className="summary-step">{content}</p>;
    return <p key={index}>{content}</p>;
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
    fetchLessonKeywords(lesson.id).then(async (storedKeywords) => {
      if (!active) return;
      setKeywords(mergeKeywords(storedSummary, storedKeywords));
      if (!storedSummary) return;
      const generatedKeywords = await generateLessonKeywords(lesson.id, storedSummary);
      if (active) setKeywords(mergeKeywords(storedSummary, generatedKeywords));
    }).catch((reason) => console.error('Không tải được từ điển keyword:', reason));
    if (storedSummary) return () => { active = false; chatControllerRef.current?.abort(); };
    fetchLessonSummary(lesson.id, retryPdfUrl || lesson.pdfUrl, summaryRetryToken > 0 || isExtractiveFallbackSummary(lesson.summary)).then((result) => {
      if (!active) return;
      setSummary(result.summary);
      setKeywords(mergeKeywords(result.summary, result.keywords));
      generateLessonKeywords(lesson.id, result.summary).then((generatedKeywords) => {
        if (active) setKeywords(mergeKeywords(result.summary, generatedKeywords));
      }).catch((reason) => console.error('Không tạo được chú giải keyword:', reason));
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
      <div className="summary-chat-composer"><textarea value={question} disabled={!summary || asking} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (shouldSubmitOnEnter({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing }) && question.trim() && summary && !asking) { event.preventDefault(); void submit(); } }} placeholder={summary ? 'Hỏi bất kỳ điều gì trong bài học…' : 'Chờ AI tạo bản tóm tắt…'} /><button disabled={!question.trim() || !summary || asking} onClick={() => void submit()}>Gửi ↑</button></div>
    </aside>
  </section>;
}
