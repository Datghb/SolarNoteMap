import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL('../supabase/migrations/20260810120000_adaptive_quiz_phase1.sql', import.meta.url);
const phase2MigrationUrl = new URL('../supabase/migrations/20260812090000_adaptive_quiz_phase2.sql', import.meta.url);

describe('adaptive quiz migration contract', () => {
  it('creates every Phase 1 table and keeps answer-bearing variants server-only', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    for (const table of ['lesson_chunks', 'lesson_keyword_sources', 'quiz_variants', 'quiz_recommendations', 'quiz_attempts', 'quiz_reports']) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).not.toMatch(/grant\s+select\s+on\s+public\.quiz_variants\s+to\s+authenticated/i);
    expect(sql).not.toMatch(/policy\s+\w+\s+on\s+public\.quiz_variants\s+for\s+select\s+to\s+authenticated/i);
  });

  it('adds the six bounded activity kinds used by the frontend', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    for (const kind of ['keyword_opened', 'slide_dwell_completed', 'quiz_recommended', 'quiz_started', 'quiz_completed', 'quiz_dismissed']) {
      expect(sql).toContain(`add value if not exists '${kind}'`);
    }
  });
});

describe('adaptive quiz Phase 2 migration contract', () => {
  it('widens counts additively and keeps every Phase 1 table', async () => {
    const sql = await readFile(phase2MigrationUrl, 'utf8');
    expect(sql).toContain('question_count between 3 and 15');
    expect(sql).toContain('drop constraint if exists quiz_attempts_answers_check');
    expect(sql).toContain("quiz_mode in ('micro', 'lesson_review')");
    expect(sql).toContain("slot_id ~ '^q(?:[1-9]|1[0-5])$'");
    expect(sql).not.toMatch(/drop table/i);
  });
});
