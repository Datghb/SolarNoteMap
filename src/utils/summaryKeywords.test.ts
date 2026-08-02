import { describe, expect, it } from 'vitest';
import { isTechnicalKeywordDefinition, splitLinesWithFirstKeywordOccurrences, splitTextWithKeywords } from './summaryKeywords';

describe('summary keyword helpers', () => {
  it('rejects course titles even when a stored explanation exists', () => {
    expect(isTechnicalKeywordDefinition({ term: 'AIINACTION · DAY05 BATCH02', definition: 'Một phần giải thích đủ dài để vượt qua giới hạn tối thiểu.' })).toBe(false);
    expect(isTechnicalKeywordDefinition({ term: 'Uncertainty', definition: 'Uncertainty mô tả mức độ không chắc chắn vốn có trong đầu ra của một hệ thống AI.' })).toBe(true);
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

  it('highlights each keyword only at its first occurrence across the summary', () => {
    const definitions = [{ term: 'AI Product', definition: 'Một sản phẩm tích hợp mô hình AI vào trải nghiệm người dùng.' }];
    expect(splitLinesWithFirstKeywordOccurrences([
      'AI Product khác sản phẩm truyền thống.',
      'Một AI Product cần được đánh giá liên tục.',
    ], definitions)).toEqual([
      [
        { text: 'AI Product', keyword: definitions[0] },
        { text: ' khác sản phẩm truyền thống.' },
      ],
      [{ text: 'Một AI Product cần được đánh giá liên tục.' }],
    ]);
  });
});
