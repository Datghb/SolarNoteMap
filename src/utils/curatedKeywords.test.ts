import { describe, expect, it } from 'vitest';
import { getCuratedSummaryKeywords, resolveSummaryKeywordDefinitions } from './curatedKeywords';

describe('curated summary keywords', () => {
  it('uses the shared CSV glossary for student-visible definitions', () => {
    const keywords = getCuratedSummaryKeywords('Một hệ thống AI cần Eval trước khi phát hành.');
    expect(keywords.find((item) => item.term === 'Eval')?.definition).toContain('kiểm tra');
  });

  it('only returns glossary entries that appear in the summary', () => {
    expect(getCuratedSummaryKeywords('Nội dung không chứa thuật ngữ phù hợp.')).toEqual([]);
  });

  it('uses the curated file as the source of truth and keeps stored definitions for missing terms', () => {
    const resolved = resolveSummaryKeywordDefinitions(
      'Eval và Private Metric đều xuất hiện trong bài.',
      [
        { term: 'Eval', definition: 'Định nghĩa cũ không còn được ưu tiên.' },
        { term: 'Private Metric', definition: 'Chỉ số riêng do giáo viên bổ sung cho bài học này.' },
      ],
    );
    expect(resolved.find((item) => item.term === 'Eval')?.definition).toContain('kiểm tra có hệ thống');
    expect(resolved.find((item) => item.term === 'Private Metric')?.definition).toContain('giáo viên bổ sung');
  });
});
