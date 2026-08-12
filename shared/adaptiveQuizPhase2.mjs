const LEVELS = Object.freeze(['recall', 'relationship', 'application']);
const STOPWORDS = new Set(['và', 'là', 'của', 'có', 'cho', 'trong', 'một', 'những', 'các', 'được', 'với', 'theo', 'từ', 'đến', 'khi', 'nào', 'gì']);

export const PHASE2_RETRIEVAL_VERSION = 'bm25-v1';
export const PHASE2_PROMPT_VERSION = 'adaptive-quiz-phase2-v1-batched';
export const PHASE2_QUESTION_PRESETS = Object.freeze([3, 5, 10]);

export function phase2SlotIds(questionCount) {
  const count = Number(questionCount);
  if (!Number.isInteger(count) || count < 3 || count > 15) throw new Error('Số câu Phase 2 phải từ 3 đến 15.');
  return Array.from({ length: count }, (_, index) => `q${index + 1}`);
}

export function resolvePhase2QuizRequest({ enabled = false, quizMode, questionCount } = {}) {
  if (!enabled) return { quizMode: 'micro', questionCount: 3, requestedQuestionCount: 3 };
  const mode = quizMode === 'lesson_review' ? 'lesson_review' : 'micro';
  const requested = Number(questionCount ?? (mode === 'lesson_review' ? 10 : 3));
  if (!Number.isInteger(requested) || requested < 3 || requested > 15) throw new Error('Số câu quiz phải là số nguyên từ 3 đến 15.');
  if (mode === 'micro' && ![3, 5].includes(requested)) throw new Error('Micro-quiz chỉ hỗ trợ 3 hoặc 5 câu.');
  if (mode === 'lesson_review' && requested < 8) throw new Error('Ôn tập toàn bài cần từ 8 đến 15 câu.');
  return { quizMode: mode, questionCount: requested, requestedQuestionCount: requested };
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('vi');
}

export function tokenizeVietnamese(value) {
  return normalizeText(value)
    .match(/[\p{L}\p{N}]+/gu)?.filter((token) => token.length > 1 && !STOPWORDS.has(token)) ?? [];
}

export function createBm25Index(chunks, { k1 = 1.2, b = 0.75 } = {}) {
  const documents = (Array.isArray(chunks) ? chunks : []).map((chunk) => {
    const text = `${chunk.title ?? ''} ${chunk.content ?? ''} ${chunk.summary ?? ''} ${(chunk.keywords ?? []).join(' ')}`;
    const tokens = tokenizeVietnamese(text);
    const termFrequency = new Map();
    for (const token of tokens) termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    return { chunk, length: tokens.length || 1, termFrequency };
  });
  const documentFrequency = new Map();
  for (const document of documents) {
    for (const term of document.termFrequency.keys()) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const averageLength = documents.length ? documents.reduce((sum, document) => sum + document.length, 0) / documents.length : 1;
  return { documents, documentFrequency, averageLength, documentCount: documents.length, k1, b, version: PHASE2_RETRIEVAL_VERSION };
}

function bm25TermScore(index, document, term) {
  const frequency = document.termFrequency.get(term) ?? 0;
  if (!frequency) return 0;
  const documentFrequency = index.documentFrequency.get(term) ?? 0;
  const inverseDocumentFrequency = Math.log(1 + (index.documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5));
  const denominator = frequency + index.k1 * (1 - index.b + index.b * document.length / index.averageLength);
  return inverseDocumentFrequency * frequency * (index.k1 + 1) / denominator;
}

export function searchBm25Index(index, {
  queryTerms = [], targetSlides = [], unclearSlides = [], currentSlide,
  maxChunks = 5, maxCharacters = 24_000, diversifyAcrossLesson = false,
} = {}) {
  const queryTokens = [...new Set((Array.isArray(queryTerms) ? queryTerms : []).flatMap(tokenizeVietnamese))];
  const targetSet = new Set(targetSlides.map(Number));
  const unclearSet = new Set(unclearSlides.map(Number));
  const current = Number(currentSlide);
  const ranked = index.documents.map((document) => {
    const chunk = document.chunk;
    const slideNumber = Number(chunk.slideNumber ?? chunk.slide_number ?? chunk.page);
    const bm25Score = queryTokens.reduce((score, term) => score + bm25TermScore(index, document, term), 0);
    let behaviorBoost = 0;
    const reasons = [];
    if (unclearSet.has(slideNumber)) { behaviorBoost += 2; reasons.push('unclear_slide'); }
    if (targetSet.has(slideNumber)) { behaviorBoost += 1.5; reasons.push('target_slide'); }
    if (current === slideNumber) { behaviorBoost += 1; reasons.push('current_slide'); }
    if ([...targetSet].some((slide) => Math.abs(slide - slideNumber) === 1)) { behaviorBoost += 0.25; reasons.push('adjacent_slide'); }
    return { ...chunk, slideNumber, bm25Score, behaviorBoost, score: bm25Score + behaviorBoost, reasons, retrievalVersion: index.version };
  }).sort((left, right) => right.score - left.score || left.slideNumber - right.slideNumber || String(left.id).localeCompare(String(right.id)));
  const selected = [];
  const selectedIds = new Set();
  let usedCharacters = 0;
  const addChunk = (chunk) => {
    const size = String(chunk.content ?? '').length + String(chunk.summary ?? '').length;
    if (selectedIds.has(String(chunk.id)) || (selected.length && usedCharacters + size > maxCharacters)) return false;
    selected.push(chunk);
    selectedIds.add(String(chunk.id));
    usedCharacters += size;
    return true;
  };
  const personalizedCount = diversifyAcrossLesson ? Math.ceil(maxChunks / 2) : maxChunks;
  for (const chunk of ranked) {
    addChunk(chunk);
    if (selected.length >= personalizedCount) break;
  }
  if (diversifyAcrossLesson && selected.length < maxChunks) {
    const bySlide = [...ranked].sort((left, right) => left.slideNumber - right.slideNumber || String(left.id).localeCompare(String(right.id)));
    const needed = maxChunks - selected.length;
    for (let index = 0; index < needed; index += 1) {
      const position = Math.round((index + 0.5) * (bySlide.length - 1) / Math.max(1, needed));
      addChunk(bySlide[position]);
    }
  }
  for (const chunk of ranked) {
    if (selected.length >= maxChunks) break;
    addChunk(chunk);
  }
  return selected;
}

function levelCounts(questionCount) {
  if (questionCount === 3) return [1, 1, 1];
  if (questionCount === 5) return [2, 2, 1];
  if (questionCount === 10) return [4, 3, 3];
  if (questionCount === 15) return [5, 5, 5];
  const base = Math.floor(questionCount / 3);
  const remainder = questionCount % 3;
  return [base + (remainder > 0 ? 1 : 0), base + (remainder > 1 ? 1 : 0), base];
}

export function buildQuizCoveragePlan({ questionCount, targetKeywords = [], evidence = [] }) {
  const slots = phase2SlotIds(questionCount);
  const keywords = [...new Set([
    ...targetKeywords,
    ...evidence.flatMap((chunk) => chunk.keywords ?? []),
    ...evidence.map((chunk) => chunk.title),
  ].map((value) => String(value ?? '').trim()).filter(Boolean))].slice(0, Math.max(3, questionCount));
  if (!keywords.length) throw new Error('Không có keyword để lập coverage plan.');
  const counts = levelCounts(questionCount);
  const levels = LEVELS.flatMap((level, index) => Array(counts[index]).fill(level));
  return slots.map((slotId, index) => ({
    slotId,
    keyword: keywords[index % keywords.length].slice(0, 80),
    level: levels[index],
  }));
}

export function batchCoveragePlan(plan, maxBatchSize = 5) {
  if (!Array.isArray(plan) || !plan.length) return [];
  const size = Math.max(1, Math.min(5, Math.round(maxBatchSize)));
  const batches = [];
  for (let index = 0; index < plan.length; index += size) batches.push(plan.slice(index, index + size));
  return batches;
}

export function quizQuestionFingerprint(question) {
  return normalizeText(`${question?.question ?? ''}|${(question?.options ?? []).join('|')}`)
    .replace(/[^\p{L}\p{N}|]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function duplicateQuestionSlots(questions) {
  const seen = new Map();
  const duplicates = [];
  for (const question of Array.isArray(questions) ? questions : []) {
    const fingerprint = quizQuestionFingerprint(question);
    if (!fingerprint) continue;
    if (seen.has(fingerprint)) duplicates.push(question.slotId);
    else seen.set(fingerprint, question.slotId);
  }
  return duplicates;
}
