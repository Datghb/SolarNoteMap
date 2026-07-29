import 'dotenv/config';
import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';
import path from 'node:path';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

dotenv.config({ path: '.env.local', override: false });

const app = express();
const port = Number(process.env.API_PORT || (process.env.NODE_ENV === 'production' ? 4173 : 8787));
const provider = process.env.AI_PROVIDER === 'groq' ? 'groq' : 'openai';
const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || (provider === 'groq' ? 'qwen/qwen3.6-27b' : 'gpt-5.6-sol');
const apiKey = provider === 'groq' ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
const client = apiKey ? new OpenAI({ apiKey, ...(provider === 'groq' ? { baseURL: 'https://api.groq.com/openai/v1' } : {}) }) : null;
const requests = new Map();
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = path.join(rootDirectory, 'day01-llm-foundation.pdf');
const summaryCacheDirectory = path.join(rootDirectory, '.solar-cache');
const summaryCachePath = path.join(summaryCacheDirectory, 'slide-summaries.json');
const summaryInFlight = new Map();
let pdfDocumentPromise;
let slideSummaryCachePromise;
let cacheWriteQueue = Promise.resolve();
let deckSignaturePromise;

async function getSlideText(pageNumber) {
  pdfDocumentPromise ??= readFile(pdfPath)
    .then((buffer) => getDocument({ data: new Uint8Array(buffer) }).promise);
  const document = await pdfDocumentPromise;
  if (pageNumber > document.numPages) throw new RangeError('Trang slide không tồn tại.');
  const page = await document.getPage(pageNumber);
  const content = await page.getTextContent();
  return content.items
    .map((item) => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14_000);
}

function loadSlideSummaryCache() {
  slideSummaryCachePromise ??= readFile(summaryCachePath, 'utf8')
    .then((content) => JSON.parse(content))
    .then((value) => value && typeof value === 'object' ? value : {})
    .catch(() => ({}));
  return slideSummaryCachePromise;
}

function getDeckSignature() {
  deckSignaturePromise ??= stat(pdfPath).then((metadata) => `${metadata.size}-${Math.round(metadata.mtimeMs)}`);
  return deckSignaturePromise;
}

function persistSlideSummaryCache(cache) {
  cacheWriteQueue = cacheWriteQueue
    .catch(() => undefined)
    .then(async () => {
      await mkdir(summaryCacheDirectory, { recursive: true });
      const temporaryPath = `${summaryCachePath}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(cache, null, 2), 'utf8');
      await rename(temporaryPath, summaryCachePath);
    })
    .catch((error) => console.error('Slide summary cache write failed:', error instanceof Error ? error.message : 'Unknown error'));
  return cacheWriteQueue;
}

async function createSlideSummary(page, slideText) {
  const instruction = 'Tóm tắt nội dung của một trang slide bằng tiếng Việt để làm ngữ cảnh ổn định cho trợ giảng AI. Giữ lại khái niệm, định nghĩa, quy trình, con số và quan hệ quan trọng. Không thêm kiến thức ngoài slide. Viết tối đa 220 từ, rõ ràng và có cấu trúc.';
  if (provider === 'groq') {
    const result = await client.chat.completions.create({
      model,
      reasoning_effort: 'none',
      messages: [{ role: 'system', content: instruction }, { role: 'user', content: `Trang ${page}:\n${slideText}` }],
      temperature: 0.3,
    });
    const summary = result.choices[0]?.message?.content?.trim();
    if (!summary) throw new Error('Groq returned an empty slide summary.');
    return summary.slice(0, 2_500);
  }
  const result = await client.responses.create({
    model,
    input: [{ role: 'developer', content: instruction }, { role: 'user', content: `Trang ${page}:\n${slideText}` }],
  });
  if (!result.output_text?.trim()) throw new Error('OpenAI returned an empty slide summary.');
  return result.output_text.trim().slice(0, 2_500);
}

async function getCachedSlideSummary(page) {
  const signature = await getDeckSignature();
  const cacheKey = `${signature}:${provider}:${model}:page-${page}`;
  const cache = await loadSlideSummaryCache();
  const cached = cache[cacheKey];
  if (cached && typeof cached.summary === 'string' && cached.summary.trim()) {
    return { summary: cached.summary, source: 'cache' };
  }
  if (summaryInFlight.has(cacheKey)) return summaryInFlight.get(cacheKey);
  const task = (async () => {
    const slideText = await getSlideText(page);
    if (!slideText) throw new Error('Không đọc được nội dung chữ trên trang slide này.');
    const summary = await createSlideSummary(page, slideText);
    const nextCache = { ...cache, [cacheKey]: { summary, page, model, provider, createdAt: new Date().toISOString() } };
    slideSummaryCachePromise = Promise.resolve(nextCache);
    await persistSlideSummaryCache(nextCache);
    return { summary, source: 'generated' };
  })().finally(() => summaryInFlight.delete(cacheKey));
  summaryInFlight.set(cacheKey, task);
  return task;
}

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use('/api', (request, response, next) => {
  const now = Date.now();
  const key = request.ip || 'unknown';
  const recent = (requests.get(key) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 20) return response.status(429).json({ error: 'Bạn đang cập nhật quá nhanh. Hãy thử lại sau một phút.' });
  requests.set(key, [...recent, now]);
  next();
});

const graphSchema = {
  type: 'object', additionalProperties: false, required: ['nodes', 'edges'],
  properties: {
    nodes: {
      type: 'array', maxItems: 12,
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'title', 'description', 'importance'],
        properties: {
          id: { type: 'string', pattern: '^[a-z0-9-]{2,48}$' },
          title: { type: 'string', maxLength: 80 },
          description: { type: 'string', maxLength: 240 },
          importance: { type: 'string', enum: ['minor', 'detail', 'support', 'important', 'core'] },
        },
      },
    },
    edges: {
      type: 'array', maxItems: 20,
      items: {
        type: 'object', additionalProperties: false,
        required: ['source', 'target', 'relation'],
        properties: {
          source: { type: 'string' }, target: { type: 'string' },
          relation: { type: 'string', maxLength: 60 },
        },
      },
    },
  },
};

function validateKnowledgeGraph(value) {
  const importance = new Set(['minor', 'detail', 'support', 'important', 'core']);
  if (!value || !Array.isArray(value.nodes) || !Array.isArray(value.edges) || value.nodes.length > 12 || value.edges.length > 20) {
    throw new Error('AI returned an invalid graph shape.');
  }
  const usedIds = new Set();
  const idMap = new Map();
  const nodes = value.nodes.map((node, index) => {
    if (!node || typeof node.id !== 'string' || typeof node.title !== 'string' || !node.title.trim() || node.title.length > 80 || typeof node.description !== 'string' || node.description.length > 240 || !importance.has(node.importance)) {
      throw new Error('AI returned an invalid graph node.');
    }
    const baseId = node.id.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 44) || `node-${index + 1}`;
    let id = baseId.length < 2 ? `n-${baseId}` : baseId;
    while (usedIds.has(id)) id = `${baseId.slice(0, 40)}-${index + 1}`;
    usedIds.add(id);
    idMap.set(node.id, id);
    return { id, title: node.title.trim(), description: node.description.trim(), importance: node.importance };
  });
  const ids = new Set(nodes.map((node) => node.id));
  const edges = value.edges.map((edge) => {
    const source = edge && idMap.get(edge.source);
    const target = edge && idMap.get(edge.target);
    if (!source || !target || !ids.has(source) || !ids.has(target) || typeof edge.relation !== 'string' || !edge.relation.trim() || edge.relation.length > 60) {
      throw new Error('AI returned an invalid graph edge.');
    }
    return { source, target, relation: edge.relation.trim() };
  });
  return { nodes, edges };
}

function parseJsonObject(content) {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI response does not contain JSON.');
  return JSON.parse(content.slice(start, end + 1));
}

app.post('/api/knowledge-map', async (request, response) => {
  const note = typeof request.body?.note === 'string' ? request.body.note.trim() : '';
  const lesson = request.body?.lesson;
  if (!note || note.length > 12_000) return response.status(400).json({ error: 'Ghi chú phải có từ 1 đến 12.000 ký tự.' });
  if (!lesson || typeof lesson.name !== 'string' || typeof lesson.prompt !== 'string') {
    return response.status(400).json({ error: 'Thông tin bài học không hợp lệ.' });
  }
  if (!client) return response.status(503).json({ error: `Máy chủ chưa được cấu hình ${provider === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY'}.` });

  try {
    const developerPrompt = 'Chuyển ghi chú học tập tiếng Việt thành bản đồ kiến thức. Chỉ dùng ý có trong ghi chú; không bổ sung kiến thức như thể học sinh đã viết. Trả về duy nhất JSON object có nodes và edges. Mỗi node gồm id, title, description, importance (minor|detail|support|important|core). Mỗi edge gồm source, target, relation. Tạo ID ngắn, ổn định; chọn đúng một core khi có ít nhất hai node; tối đa 12 node và 20 edge.';
    const userPrompt = `Bài học: ${lesson.name}\nCâu hỏi dẫn đường: ${lesson.prompt}\n\nGhi chú của học sinh:\n${note}`;
    if (provider === 'groq') {
      const result = await client.chat.completions.create({
        model,
        messages: [{ role: 'system', content: developerPrompt }, { role: 'user', content: userPrompt }],
        reasoning_effort: 'none',
        temperature: 0.7,
      });
      const content = result.choices[0]?.message?.content;
      if (!content) throw new Error('Groq returned an empty graph.');
      response.json({ graph: validateKnowledgeGraph(parseJsonObject(content)), model: result.model, provider });
    } else {
      const result = await client.responses.create({
        model,
        reasoning: { effort: 'none' },
        input: [{ role: 'developer', content: developerPrompt }, { role: 'user', content: userPrompt }],
        text: { verbosity: 'low', format: { type: 'json_schema', name: 'knowledge_map', strict: true, schema: graphSchema } },
      });
      response.json({ graph: validateKnowledgeGraph(JSON.parse(result.output_text)), model: result.model, provider });
    }
  } catch (error) {
    console.error('Knowledge map generation failed:', error instanceof Error ? error.message : 'Unknown error');
    if (error && typeof error === 'object' && 'status' in error && error.status === 429) {
      return response.status(503).json({ error: `${provider === 'groq' ? 'Groq free tier' : 'OpenAI'} đã đạt giới hạn. Đang dùng phân tích cục bộ.` });
    }
    response.status(502).json({ error: 'AI chưa thể cập nhật sơ đồ. Ứng dụng sẽ dùng phân tích cục bộ.' });
  }
});

app.post('/api/slide-question', async (request, response) => {
  const page = Number(request.body?.page);
  const question = typeof request.body?.question === 'string' ? request.body.question.trim() : '';
  const note = typeof request.body?.note === 'string' ? request.body.note.trim().slice(0, 4_000) : '';
  const image = typeof request.body?.image === 'string' ? request.body.image : '';
  if (!Number.isInteger(page) || page < 1 || page > 100) return response.status(400).json({ error: 'Trang slide không hợp lệ.' });
  if (!question || question.length > 1_000) return response.status(400).json({ error: 'Câu hỏi phải có từ 1 đến 1.000 ký tự.' });
  if (image && (!/^data:image\/(?:jpeg|png);base64,[a-zA-Z0-9+/=]+$/.test(image) || image.length > 750_000)) {
    return response.status(400).json({ error: 'Ảnh vùng chọn không hợp lệ hoặc quá lớn.' });
  }
  if (!client) return response.status(503).json({ error: `Máy chủ chưa được cấu hình ${provider === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY'}.` });

  try {
    const slideContext = await getCachedSlideSummary(page);
    const tutorPrompt = 'Bạn là trợ giảng AI cho học sinh Việt Nam. Trả lời ngắn gọn, dễ hiểu, bám sát nội dung slide được cung cấp. Nếu slide không đủ dữ kiện, nói rõ điều đó; không bịa thông tin. Ưu tiên ví dụ đơn giản và kết thúc bằng một câu kiểm tra hiểu bài khi phù hợp.';
    const questionContext = `Trang slide: ${page}\n\nBản tóm tắt đã lưu của slide:\n${slideContext.summary}\n\nGhi chú của học sinh:\n${note || '(chưa có)'}\n\nCâu hỏi:\n${question}`;
    if (provider === 'groq') {
      const result = await client.chat.completions.create({
        model,
        reasoning_effort: 'none',
        messages: [
          { role: 'system', content: tutorPrompt },
          { role: 'user', content: image ? [{ type: 'text', text: questionContext }, { type: 'image_url', image_url: { url: image } }] : questionContext },
        ],
        temperature: 0.7,
      });
      const answer = result.choices[0]?.message?.content;
      if (!answer) throw new Error('Groq returned an empty answer.');
      response.json({ answer, model: result.model, provider, page, slideContext: slideContext.source });
    } else {
      const result = await client.responses.create({
        model,
        input: [
          { role: 'developer', content: tutorPrompt },
          { role: 'user', content: [{ type: 'input_text', text: questionContext }, ...(image ? [{ type: 'input_image', image_url: image }] : [])] },
        ],
      });
      response.json({ answer: result.output_text, model: result.model, provider, page, slideContext: slideContext.source });
    }
  } catch (error) {
    console.error('Slide question failed:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof RangeError) return response.status(400).json({ error: error.message });
    if (error && typeof error === 'object' && 'status' in error && error.status === 429) {
      return response.status(503).json({ error: `${provider === 'groq' ? 'Groq free tier' : 'OpenAI'} đã đạt giới hạn sử dụng.` });
    }
    response.status(502).json({ error: 'AI chưa thể trả lời câu hỏi trên slide lúc này.' });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(rootDirectory, 'dist')));
  app.get('/*splat', (_request, response) => response.sendFile(path.join(rootDirectory, 'dist', 'index.html')));
}

app.listen(port, () => console.log(`Solar Note Map server listening on http://localhost:${port}`));
