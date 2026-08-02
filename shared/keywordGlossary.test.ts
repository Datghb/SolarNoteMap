import { describe, expect, it } from 'vitest';
import { findGlossaryMatches, parseKeywordGlossaryCsv, selectFirstGlossaryMatches } from './keywordGlossary.mjs';

describe('curated keyword glossary', () => {
  const csv = '\uFEFFCategory,Keyword,Vietnamese_Term,Explanation,Level,Origin\nAI,"Artificial Intelligence (AI)",Trí tuệ nhân tạo,"Lĩnh vực xây dựng hệ thống có khả năng suy luận, dự đoán và ra quyết định.",Cơ bản,Bổ sung\nRAG,Eval,Đánh giá mô hình,"Quy trình đo lường có hệ thống chất lượng đầu ra của mô hình AI.",Cơ bản,Từ nội dung gốc';

  it('parses curated explanations and aliases', () => {
    const glossary = parseKeywordGlossaryCsv(csv);
    expect(glossary).toHaveLength(2);
    expect(glossary[0].aliases).toEqual(expect.arrayContaining(['Artificial Intelligence (AI)', 'Artificial Intelligence', 'AI', 'Trí tuệ nhân tạo']));
  });

  it('matches acronyms as whole terms and returns the curated explanation', () => {
    const matches = findGlossaryMatches('AI cần Eval, nhưng MAIL không phải AI.', parseKeywordGlossaryCsv(csv));
    expect(matches.map((item) => item.term)).toEqual(['AI', 'Eval']);
    expect(matches[0].definition).toContain('suy luận');
  });

  it('selects only the first alias for the same canonical keyword', () => {
    const glossary = parseKeywordGlossaryCsv(csv);
    const matches = findGlossaryMatches('Artificial Intelligence (AI) còn được gọi ngắn là AI.', glossary);
    expect(selectFirstGlossaryMatches(matches)).toHaveLength(1);
    expect(selectFirstGlossaryMatches(matches)[0].term).toBe('Artificial Intelligence (AI)');
  });
});
