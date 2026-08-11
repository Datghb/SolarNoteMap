const SLOT_IDS = Object.freeze(['q1', 'q2', 'q3']);
const LEVELS = new Set(['recall', 'relationship', 'application']);

export const QUIZ_QUESTION_COUNT = 3;
export const QUIZ_PROMPT_VERSION = 'adaptive-quiz-phase1-v1';

export const quizDraftJsonSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['slotId', 'question', 'options', 'correctIndex', 'explanation', 'keyword', 'sourceChunkIds', 'sourceSlides', 'level'],
        properties: {
          slotId: { type: 'string', enum: SLOT_IDS },
          question: { type: 'string', minLength: 8, maxLength: 500 },
          options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string', minLength: 1, maxLength: 300 } },
          correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
          explanation: { type: 'string', minLength: 8, maxLength: 800 },
          keyword: { type: 'string', minLength: 1, maxLength: 80 },
          sourceChunkIds: { type: 'array', minItems: 1, maxItems: 5, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 100 } },
          sourceSlides: { type: 'array', minItems: 1, maxItems: 10, uniqueItems: true, items: { type: 'integer', minimum: 1, maximum: 500 } },
          level: { type: 'string', enum: [...LEVELS] },
        },
      },
    },
  },
});

export const verifierJsonSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array', minItems: 1, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['slotId', 'verdict', 'issues', 'retryInstruction'],
        properties: {
          slotId: { type: 'string', enum: SLOT_IDS },
          verdict: { type: 'string', enum: ['pass', 'retry'] },
          issues: {
            type: 'array', maxItems: 8,
            items: {
              type: 'object', additionalProperties: false,
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', minLength: 2, maxLength: 80 },
                message: { type: 'string', minLength: 2, maxLength: 500 },
              },
            },
          },
          retryInstruction: { type: 'string', maxLength: 800 },
        },
      },
    },
  },
});

export function normalizeQuizTerm(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

export function resolveQuizKnowledgeState({ sourceIdentity, artifact, chunks }) {
  const identity = String(sourceIdentity ?? '').trim();
  const currentChunks = (Array.isArray(chunks) ? chunks : []).filter((chunk) => {
    const chunkIdentity = String(chunk?.source_identity ?? chunk?.sourceIdentity ?? '').trim();
    return identity && chunkIdentity === identity;
  });
  const chunkPages = [...new Set(currentChunks
    .map((chunk) => Number(chunk?.slide_number ?? chunk?.slideNumber ?? chunk?.page))
    .filter((page) => Number.isInteger(page) && page >= 1 && page <= 500))]
    .sort((left, right) => left - right);
  const currentArtifact = artifact && String(artifact.source_identity ?? artifact.sourceIdentity ?? '').trim() === identity
    ? artifact
    : null;
  return {
    ready: currentChunks.length > 0 && chunkPages.length > 0,
    currentChunks,
    chunkPages,
    currentArtifact,
  };
}

export function evaluateCompletedQuizPolicy({ completedAt = [], now = Date.now(), cooldownSeconds = 600, maxCompleted = 3 }) {
  const timestamps = (Array.isArray(completedAt) ? completedAt : [])
    .map((value) => Date.parse(String(value ?? '')))
    .filter(Number.isFinite)
    .sort((left, right) => right - left);
  const cooldown = Math.max(0, Math.round(Number(cooldownSeconds) || 0));
  const limit = Math.max(1, Math.round(Number(maxCompleted) || 1));
  const remainingSeconds = timestamps.length
    ? Math.max(0, Math.ceil((timestamps[0] + cooldown * 1_000 - Number(now)) / 1_000))
    : 0;
  if (remainingSeconds > 0) return { allowed: false, reason: 'cooldown', remainingSeconds };
  if (timestamps.length >= limit) return { allowed: false, reason: 'daily_limit', remainingSeconds: 0 };
  return { allowed: true, reason: 'ready', remainingSeconds: 0 };
}

export function quizVariantMatchesMode(variant, requestedMode = 'live') {
  const storedMode = variant?.validation && typeof variant.validation === 'object' ? variant.validation.mode : null;
  return requestedMode === 'mock' ? storedMode === 'mock' : storedMode !== 'mock';
}

function uniqueStrings(values, limit, maxLength = 100) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const clean = String(value ?? '').trim().slice(0, maxLength);
    const key = normalizeQuizTerm(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= limit) break;
  }
  return result;
}

function uniqueSlides(values, limit = 10) {
  return [...new Set((Array.isArray(values) ? values : []).map(Number).filter((page) => Number.isInteger(page) && page >= 1 && page <= 500))]
    .sort((a, b) => a - b)
    .slice(0, limit);
}

export function canonicalQuizTarget({ sourceIdentity, targetKeywords, targetSlides, difficulty = 'basic', questionCount = QUIZ_QUESTION_COUNT }) {
  return JSON.stringify({
    sourceIdentity: String(sourceIdentity ?? '').trim(),
    targetKeywords: uniqueStrings(targetKeywords, 5, 80).map(normalizeQuizTerm).sort(),
    targetSlides: uniqueSlides(targetSlides),
    difficulty,
    questionCount,
  });
}

function graphRelatedSlides(graph, targetKeywords) {
  const keywords = targetKeywords.map(normalizeQuizTerm).filter(Boolean);
  if (!keywords.length || !graph || !Array.isArray(graph.nodes)) return new Set();
  const matchingIds = new Set();
  for (const node of graph.nodes) {
    const nodeTitle = normalizeQuizTerm(node?.title);
    const haystack = normalizeQuizTerm(`${node?.title ?? ''} ${node?.description ?? node?.note ?? ''}`);
    if (keywords.some((keyword) => haystack.includes(keyword) || (nodeTitle && keyword.includes(nodeTitle)))) matchingIds.add(node?.id);
  }
  const relatedIds = new Set(matchingIds);
  for (const edge of Array.isArray(graph.edges) ? graph.edges : []) {
    const source = edge?.source ?? edge?.from;
    const target = edge?.target ?? edge?.to;
    if (matchingIds.has(source)) relatedIds.add(target);
    if (matchingIds.has(target)) relatedIds.add(source);
  }
  const pages = new Set();
  for (const node of graph.nodes) {
    if (!relatedIds.has(node?.id)) continue;
    for (const page of uniqueSlides(node?.slideNumbers, 20)) pages.add(page);
  }
  return pages;
}

export function rankQuizEvidence({ chunks, graph, targetKeywords = [], targetSlides = [], unclearSlides = [], currentSlide, maxChunks = 5, maxCharacters = 24_000 }) {
  const keywords = uniqueStrings(targetKeywords, 5, 80);
  const normalizedKeywords = keywords.map(normalizeQuizTerm);
  const targetPageSet = new Set(uniqueSlides(targetSlides));
  const unclearPageSet = new Set(uniqueSlides(unclearSlides));
  const graphPages = graphRelatedSlides(graph, keywords);
  const currentPage = Number.isInteger(Number(currentSlide)) ? Number(currentSlide) : null;

  const ranked = (Array.isArray(chunks) ? chunks : []).flatMap((chunk) => {
    const page = Number(chunk?.slideNumber ?? chunk?.slide_number ?? chunk?.page);
    const id = String(chunk?.id ?? `slide-${page}-chunk-${Number(chunk?.chunkIndex ?? chunk?.chunk_index ?? 0)}`).trim();
    const title = String(chunk?.title ?? `Slide ${page}`).trim().slice(0, 180);
    const content = String(chunk?.content ?? chunk?.summary ?? '').trim().slice(0, 20_000);
    const summary = String(chunk?.summary ?? content).trim().slice(0, 4_000);
    const chunkKeywords = uniqueStrings(chunk?.keywords ?? chunk?.keyConcepts, 20, 80);
    if (!id || !Number.isInteger(page) || page < 1 || page > 500 || (!content && !summary)) return [];
    const haystack = normalizeQuizTerm(`${title} ${content} ${summary} ${chunkKeywords.join(' ')}`);
    const exactMatches = normalizedKeywords.filter((keyword) => keyword && haystack.includes(keyword)).length;
    let score = 0;
    const reasons = [];
    if (unclearPageSet.has(page)) { score += 5; reasons.push('unclear_slide'); }
    if (exactMatches) { score += 4 * exactMatches; reasons.push('keyword_match'); }
    if (currentPage === page || targetPageSet.has(page)) { score += 3; reasons.push('target_slide'); }
    if (graphPages.has(page)) { score += 2; reasons.push('graph_related'); }
    if ([...targetPageSet].some((target) => Math.abs(target - page) === 1)) { score += 1; reasons.push('adjacent_slide'); }
    return [{ id, slideNumber: page, title, content, summary, keywords: chunkKeywords, score, reasons }];
  }).sort((left, right) => right.score - left.score || left.slideNumber - right.slideNumber || left.id.localeCompare(right.id));

  const positive = ranked.filter((chunk) => chunk.score > 0);
  const candidates = positive.length ? positive : ranked;
  const selected = [];
  let usedCharacters = 0;
  for (const chunk of candidates) {
    const size = chunk.content.length + chunk.summary.length;
    if (selected.length && usedCharacters + size > maxCharacters) continue;
    selected.push(chunk);
    usedCharacters += size;
    if (selected.length >= maxChunks) break;
  }
  return selected;
}

function validateQuestion(question, context, expectedSlot) {
  if (!question || typeof question !== 'object') throw new Error(`Quiz ${expectedSlot} không phải object.`);
  if (question.slotId !== expectedSlot) throw new Error(`Quiz thiếu hoặc sai slot ${expectedSlot}.`);
  const prompt = String(question.question ?? '').trim();
  if (prompt.length < 8 || prompt.length > 500) throw new Error(`${expectedSlot} có câu hỏi không hợp lệ.`);
  if (!Array.isArray(question.options) || question.options.length !== 4) throw new Error(`${expectedSlot} phải có đúng 4 lựa chọn.`);
  const options = question.options.map((option) => String(option ?? '').trim());
  if (options.some((option) => !option || option.length > 300)) throw new Error(`${expectedSlot} có lựa chọn không hợp lệ.`);
  if (new Set(options.map(normalizeQuizTerm)).size !== 4) throw new Error(`${expectedSlot} có lựa chọn trùng nhau.`);
  const correctIndex = Number(question.correctIndex);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) throw new Error(`${expectedSlot} có đáp án đúng không hợp lệ.`);
  const explanation = String(question.explanation ?? '').trim();
  if (explanation.length < 8 || explanation.length > 800) throw new Error(`${expectedSlot} có giải thích không hợp lệ.`);
  const keyword = String(question.keyword ?? '').trim();
  if (!keyword || keyword.length > 80) throw new Error(`${expectedSlot} có keyword không hợp lệ.`);
  const allowedKeywordSet = new Set(context.allowedKeywords.map(normalizeQuizTerm));
  if (allowedKeywordSet.size && !allowedKeywordSet.has(normalizeQuizTerm(keyword))) throw new Error(`${expectedSlot} dùng keyword ngoài context.`);
  const sourceChunkIds = uniqueStrings(question.sourceChunkIds, 5, 100);
  if (!sourceChunkIds.length || sourceChunkIds.some((id) => !context.allowedChunkIds.has(id))) throw new Error(`${expectedSlot} tham chiếu chunk không hợp lệ.`);
  const sourceSlides = uniqueSlides(question.sourceSlides);
  if (!sourceSlides.length || sourceSlides.some((page) => !context.allowedSlides.has(page))) throw new Error(`${expectedSlot} tham chiếu slide không hợp lệ.`);
  const citedSlides = new Set(sourceChunkIds.map((id) => context.chunkSlides.get(id)).filter(Number.isInteger));
  if (sourceSlides.some((page) => !citedSlides.has(page))) throw new Error(`${expectedSlot} có slide nguồn không khớp chunk trích dẫn.`);
  if (!LEVELS.has(question.level)) throw new Error(`${expectedSlot} có cognitive level không hợp lệ.`);
  const expectedLevel = { q1: 'recall', q2: 'relationship', q3: 'application' }[expectedSlot];
  if (expectedLevel && question.level !== expectedLevel) throw new Error(`${expectedSlot} không đúng cognitive level ${expectedLevel}.`);
  return { slotId: expectedSlot, question: prompt, options, correctIndex, explanation, keyword, sourceChunkIds, sourceSlides, level: question.level };
}

export function validateQuizDraft(value, { evidence, allowedKeywords = [], expectedSlots = SLOT_IDS } = {}) {
  if (!value || !Array.isArray(value.questions)) throw new Error('AI không trả về danh sách câu hỏi.');
  const slots = uniqueStrings(expectedSlots, 3, 2);
  if (value.questions.length !== slots.length) throw new Error(`AI phải trả về đúng ${slots.length} câu hỏi.`);
  const bySlot = new Map(value.questions.map((question) => [question?.slotId, question]));
  if (bySlot.size !== value.questions.length) throw new Error('AI trả về slot câu hỏi bị trùng.');
  const safeEvidence = Array.isArray(evidence) ? evidence : [];
  const chunkSlides = new Map(safeEvidence.map((chunk) => [String(chunk.id), Number(chunk.slideNumber)]));
  const allowedChunkIds = new Set(chunkSlides.keys());
  const allowedSlides = new Set([...chunkSlides.values()].filter(Number.isInteger));
  if (!allowedChunkIds.size || !allowedSlides.size) throw new Error('Không có evidence hợp lệ để kiểm tra quiz.');
  return slots.map((slot) => validateQuestion(bySlot.get(slot), { allowedChunkIds, allowedSlides, allowedKeywords, chunkSlides }, slot));
}

export function validateVerifierReview(value, expectedSlots = SLOT_IDS) {
  if (!value || !Array.isArray(value.items)) throw new Error('Verifier không trả về danh sách review.');
  const slots = uniqueStrings(expectedSlots, 3, 2);
  if (value.items.length !== slots.length) throw new Error('Verifier không review đủ các slot yêu cầu.');
  const bySlot = new Map(value.items.map((item) => [item?.slotId, item]));
  if (bySlot.size !== value.items.length) throw new Error('Verifier trả về slot bị trùng.');
  return slots.map((slotId) => {
    const item = bySlot.get(slotId);
    if (!item || !['pass', 'retry'].includes(item.verdict) || !Array.isArray(item.issues)) throw new Error(`Verifier trả kết quả không hợp lệ cho ${slotId}.`);
    const issues = item.issues.slice(0, 8).map((issue) => ({
      code: String(issue?.code ?? '').trim().slice(0, 80),
      message: String(issue?.message ?? '').trim().slice(0, 500),
    })).filter((issue) => issue.code && issue.message);
    const retryInstruction = String(item.retryInstruction ?? '').trim().slice(0, 800);
    if (item.verdict === 'pass' && issues.length) throw new Error(`Verifier vừa pass vừa báo lỗi cho ${slotId}.`);
    if (item.verdict === 'retry' && (!issues.length || !retryInstruction)) throw new Error(`Verifier thiếu hướng dẫn retry cho ${slotId}.`);
    return { slotId, verdict: item.verdict, issues, retryInstruction };
  });
}

export function mergeRegeneratedQuestions(currentQuestions, replacementQuestions, expectedSlots) {
  const replacementSlots = new Set(expectedSlots);
  if (replacementQuestions.some((question) => !replacementSlots.has(question.slotId))) throw new Error('Quizer đã thay đổi slot không được retry.');
  const replacementBySlot = new Map(replacementQuestions.map((question) => [question.slotId, question]));
  if (replacementBySlot.size !== replacementSlots.size) throw new Error('Quizer không tạo lại đủ slot bị fail.');
  return currentQuestions.map((question) => replacementBySlot.get(question.slotId) ?? question);
}

export function createMockQuizDraft({ evidence, targetKeywords = [] }) {
  const safeEvidence = Array.isArray(evidence) ? evidence : [];
  if (!safeEvidence.length) throw new Error('Mock quiz cần ít nhất một evidence chunk.');
  const allowedKeywords = uniqueStrings(targetKeywords, 5, 80);
  const levels = ['recall', 'relationship', 'application'];
  const prompts = [
    'Theo nội dung slide nguồn, mô tả nào phù hợp nhất với keyword',
    'Theo nội dung slide nguồn, nhận định nào thể hiện đúng mối liên hệ quanh keyword',
    'Nếu vận dụng đúng nội dung slide nguồn, lựa chọn nào phù hợp nhất với keyword',
  ];
  const keyword = allowedKeywords[0] ?? uniqueStrings(safeEvidence[0]?.keywords, 1, 80)[0] ?? String(safeEvidence[0]?.title ?? 'nội dung bài học').slice(0, 80);
  const questions = SLOT_IDS.map((slotId, index) => {
    const chunk = safeEvidence[index % safeEvidence.length];
    const chunkId = String(chunk.id);
    const slideNumber = Number(chunk.slideNumber ?? chunk.slide_number);
    const correct = String(chunk.summary || chunk.content).trim().slice(0, 220);
    return {
      slotId,
      question: `[MOCK] ${prompts[index]} “${keyword}”?`,
      options: [
        correct,
        `Phương án mô phỏng ${index + 1}A không được slide ${slideNumber} hỗ trợ.`,
        `Phương án mô phỏng ${index + 1}B nằm ngoài phạm vi slide ${slideNumber}.`,
        `Phương án mô phỏng ${index + 1}C mâu thuẫn với nguồn đã retrieval.`,
      ],
      correctIndex: 0,
      explanation: `[MOCK] Đáp án này được đối chiếu trực tiếp với nội dung Slide ${slideNumber}.`,
      keyword,
      sourceChunkIds: [chunkId],
      sourceSlides: [slideNumber],
      level: levels[index],
    };
  });
  return validateQuizDraft({ questions }, { evidence: safeEvidence, allowedKeywords });
}

export function serializePublicQuiz(questions) {
  return questions.map(({ slotId, question, options, keyword, sourceSlides, level }) => ({ slotId, question, options, keyword, sourceSlides, level }));
}

export function scoreQuizAnswers(questions, answers) {
  if (!Array.isArray(questions) || questions.length !== QUIZ_QUESTION_COUNT || !Array.isArray(answers) || answers.length !== questions.length) {
    throw new Error('Bài làm không hợp lệ.');
  }
  const selected = answers.map(Number);
  if (selected.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 3)) throw new Error('Lựa chọn đáp án không hợp lệ.');
  const items = questions.map((question, index) => ({
    slotId: question.slotId,
    selectedIndex: selected[index],
    correctIndex: question.correctIndex,
    correct: selected[index] === question.correctIndex,
    explanation: question.explanation,
    sourceSlides: question.sourceSlides,
    keyword: question.keyword,
  }));
  return { score: items.filter((item) => item.correct).length, questionCount: questions.length, items };
}

export const adaptiveQuizSlotIds = SLOT_IDS;
