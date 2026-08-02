import { describe, expect, it } from 'vitest';
import { extractKeywordDefinitions, splitTextWithKeywords } from './summaryKeywords';

describe('summary keyword helpers', () => {
  it('extracts keyword definitions from glossary-style lines', () => {
    const summary = [
      '## Thuật ngữ chuyên ngành',
      '- **LLM**: Mô hình ngôn ngữ lớn được huấn luyện trên lượng dữ liệu lớn.',
      '- **Token** — Đơn vị nhỏ mà mô hình dùng để xử lý văn bản.',
    ].join('\n');

    expect(extractKeywordDefinitions(summary)).toEqual([
      { term: 'LLM', definition: 'Mô hình ngôn ngữ lớn được huấn luyện trên lượng dữ liệu lớn.' },
      { term: 'Token', definition: 'Đơn vị nhỏ mà mô hình dùng để xử lý văn bản.' },
    ]);
  });

  it('does not classify bold narrative content as a keyword', () => {
    const summary = '**Embedding** biểu diễn dữ liệu dưới dạng vector nhiều chiều.';
    expect(extractKeywordDefinitions(summary)).toEqual([]);
  });

  it('prefers a glossary definition over an earlier bold narrative occurrence', () => {
    const summary = [
      '**LLM** giúp xử lý ngôn ngữ trong nhiều ứng dụng.',
      '## Bảng thuật ngữ',
      '- **LLM**: Mô hình ngôn ngữ lớn được huấn luyện trên kho dữ liệu văn bản.',
    ].join('\n');
    expect(extractKeywordDefinitions(summary)).toEqual([
      { term: 'LLM', definition: 'Mô hình ngôn ngữ lớn được huấn luyện trên kho dữ liệu văn bản.' },
    ]);
  });

  it('rejects course titles and long phrases even inside the glossary', () => {
    const summary = [
      '## Bảng thuật ngữ',
      '- **AIINACTION · DAY05 BATCH02**: Tên chuỗi bài học.',
      '- **Bài học tập trung vào giai đoạn Kick off Sprint của một dự án**: Một đoạn mô tả.',
      '- **Uncertainty**: Mức độ không chắc chắn trong kết quả của mô hình.',
    ].join('\n');
    expect(extractKeywordDefinitions(summary)).toEqual([
      { term: 'Uncertainty', definition: 'Mức độ không chắc chắn trong kết quả của mô hình.' },
    ]);
  });

  it('splits plain text case-insensitively and prefers longer matching terms', () => {
    const definitions = [
      { term: 'AI', definition: 'Trí tuệ nhân tạo.' },
      { term: 'Generative AI', definition: 'AI có khả năng tạo nội dung.' },
    ];

    expect(splitTextWithKeywords('Generative AI hỗ trợ AI.', definitions)).toEqual([
      { text: 'Generative AI', keyword: definitions[1] },
      { text: ' hỗ trợ ' },
      { text: 'AI', keyword: definitions[0] },
      { text: '.' },
    ]);
  });

  it('matches whole terms instead of fragments inside other words', () => {
    const definitions = [{ term: 'AI', definition: 'Trí tuệ nhân tạo.' }];
    expect(splitTextWithKeywords('AI khác với MAIL', definitions)).toEqual([
      { text: 'AI', keyword: definitions[0] },
      { text: ' khác với MAIL' },
    ]);
  });
});
