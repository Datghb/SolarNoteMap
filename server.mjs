import 'dotenv/config';
import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

dotenv.config({ path: '.env.local', override: false });

const app = express();
const port = Number(process.env.API_PORT || (process.env.NODE_ENV === 'production' ? 4173 : 8787));
const model = process.env.OPENAI_MODEL || 'gpt-5.6-sol';
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const requests = new Map();
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
let pdfDocumentPromise;

async function getSlideText(pageNumber) {
  pdfDocumentPromise ??= readFile(path.join(rootDirectory, 'day01-llm-foundation.pdf'))
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

app.disable('x-powered-by');
app.use(express.json({ limit: '24kb' }));
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

app.post('/api/knowledge-map', async (request, response) => {
  const note = typeof request.body?.note === 'string' ? request.body.note.trim() : '';
  const lesson = request.body?.lesson;
  if (!note || note.length > 12_000) return response.status(400).json({ error: 'Ghi chú phải có từ 1 đến 12.000 ký tự.' });
  if (!lesson || typeof lesson.name !== 'string' || typeof lesson.prompt !== 'string') {
    return response.status(400).json({ error: 'Thông tin bài học không hợp lệ.' });
  }
  if (!client) return response.status(503).json({ error: 'Máy chủ chưa được cấu hình OpenAI API key.' });

  try {
    const result = await client.responses.create({
      model,
      reasoning: { effort: 'none' },
      input: [
        { role: 'developer', content: 'Chuyển ghi chú học tập tiếng Việt thành bản đồ kiến thức. Chỉ dùng ý có trong ghi chú; không bổ sung kiến thức như thể học sinh đã viết. Tạo ID ngắn, ổn định theo khái niệm. Chọn đúng một node core khi có ít nhất hai node. Edge phải nối node tồn tại, có hướng và nhãn ngắn, cụ thể. Tối đa 12 node.' },
        { role: 'user', content: `Bài học: ${lesson.name}\nCâu hỏi dẫn đường: ${lesson.prompt}\n\nGhi chú của học sinh:\n${note}` },
      ],
      text: { verbosity: 'low', format: { type: 'json_schema', name: 'knowledge_map', strict: true, schema: graphSchema } },
    });
    response.json({ graph: JSON.parse(result.output_text), model: result.model });
  } catch (error) {
    console.error('Knowledge map generation failed:', error instanceof Error ? error.message : 'Unknown error');
    if (error && typeof error === 'object' && 'status' in error && error.status === 429) {
      return response.status(503).json({ error: 'Tài khoản OpenAI đã hết quota hoặc chưa bật thanh toán. Đang dùng phân tích cục bộ.' });
    }
    response.status(502).json({ error: 'AI chưa thể cập nhật sơ đồ. Ứng dụng sẽ dùng phân tích cục bộ.' });
  }
});

app.post('/api/slide-question', async (request, response) => {
  const page = Number(request.body?.page);
  const question = typeof request.body?.question === 'string' ? request.body.question.trim() : '';
  const note = typeof request.body?.note === 'string' ? request.body.note.trim().slice(0, 4_000) : '';
  if (!Number.isInteger(page) || page < 1 || page > 100) return response.status(400).json({ error: 'Trang slide không hợp lệ.' });
  if (!question || question.length > 1_000) return response.status(400).json({ error: 'Câu hỏi phải có từ 1 đến 1.000 ký tự.' });
  if (!client) return response.status(503).json({ error: 'Máy chủ chưa được cấu hình OpenAI API key.' });

  try {
    const slideText = await getSlideText(page);
    if (!slideText) return response.status(422).json({ error: 'Không đọc được nội dung chữ trên trang slide này.' });
    const result = await client.responses.create({
      model,
      reasoning: { effort: 'none' },
      input: [
        { role: 'developer', content: 'Bạn là trợ giảng AI cho học sinh Việt Nam. Trả lời ngắn gọn, dễ hiểu, bám sát nội dung slide được cung cấp. Nếu slide không đủ dữ kiện, nói rõ điều đó; không bịa thông tin. Ưu tiên giải thích bằng ví dụ đơn giản và kết thúc bằng một câu kiểm tra hiểu bài khi phù hợp.' },
        { role: 'user', content: `Trang slide: ${page}\n\nNội dung trích xuất từ slide:\n${slideText}\n\nGhi chú của học sinh:\n${note || '(chưa có)'}\n\nCâu hỏi:\n${question}` },
      ],
      text: { verbosity: 'low' },
    });
    response.json({ answer: result.output_text, model: result.model, page });
  } catch (error) {
    console.error('Slide question failed:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof RangeError) return response.status(400).json({ error: error.message });
    if (error && typeof error === 'object' && 'status' in error && error.status === 429) {
      return response.status(503).json({ error: 'Tài khoản OpenAI đã hết quota hoặc chưa bật thanh toán.' });
    }
    response.status(502).json({ error: 'AI chưa thể trả lời câu hỏi trên slide lúc này.' });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(rootDirectory, 'dist')));
  app.get('/*splat', (_request, response) => response.sendFile(path.join(rootDirectory, 'dist', 'index.html')));
}

app.listen(port, () => console.log(`Solar Note Map server listening on http://localhost:${port}`));
