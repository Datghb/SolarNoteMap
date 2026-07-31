import { supabase } from '../lib/supabase';
import type { SummaryChatMessage } from './lessonSummary';

const MAX_MESSAGES = 100;
const MAX_CONTENT_LENGTH = 4_000;

export function sanitizeSummaryChatMessages(value: unknown): SummaryChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((message): message is { role: string; content: string } =>
      Boolean(message)
      && typeof message.role === 'string'
      && typeof message.content === 'string',
    )
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role as SummaryChatMessage['role'],
      content: message.content.trim().slice(0, MAX_CONTENT_LENGTH),
    }))
    .filter((message) => Boolean(message.content))
    .slice(-MAX_MESSAGES);
}

async function getStorageIdentity() {
  if (!supabase) return 'local-user';
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? 'local-user';
}

async function getStorageKey(lessonId: string) {
  return `solar-summary-chat:${await getStorageIdentity()}:${lessonId}`;
}

export async function loadSummaryChat(lessonId: string) {
  const storageKey = await getStorageKey(lessonId);
  let localMessages: SummaryChatMessage[] = [];
  try {
    localMessages = sanitizeSummaryChatMessages(JSON.parse(localStorage.getItem(storageKey) ?? '[]'));
  } catch {
    localStorage.removeItem(storageKey);
  }
  if (!supabase) return localMessages;
  const { data, error } = await supabase
    .from('lesson_summary_chats')
    .select('messages')
    .eq('lesson_id', lessonId)
    .maybeSingle();
  if (error || !data) return localMessages;
  const cloudMessages = sanitizeSummaryChatMessages(data.messages);
  localStorage.setItem(storageKey, JSON.stringify(cloudMessages));
  return cloudMessages;
}

export async function saveSummaryChat(lessonId: string, value: SummaryChatMessage[]) {
  const messages = sanitizeSummaryChatMessages(value);
  const storageKey = await getStorageKey(lessonId);
  localStorage.setItem(storageKey, JSON.stringify(messages));
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  await supabase.from('lesson_summary_chats').upsert({
    lesson_id: lessonId,
    user_id: userId,
    messages,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'lesson_id,user_id' });
}
