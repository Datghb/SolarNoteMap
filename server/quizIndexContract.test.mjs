import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const serverUrl = new URL('../server.mjs', import.meta.url);
const adaptiveRouterUrl = new URL('./adaptiveQuiz.mjs', import.meta.url);

describe('independent PDF quiz index contract', () => {
  it('extracts and persists raw PDF chunks before any graph AI call', async () => {
    const source = await readFile(serverUrl, 'utf8');
    const extractionStart = source.indexOf('async function extractPdfSlides');
    const summarizationStart = source.indexOf('async function createSlideSummaries', extractionStart);
    const generateStart = source.indexOf('async function generateLessonKnowledgeArtifact');
    const endpointStart = source.indexOf("app.post('/api/lesson-quiz-index/generate'");
    expect(extractionStart).toBeGreaterThan(0);
    expect(source.slice(extractionStart, summarizationStart)).not.toContain('createSlideSummary(');
    expect(source.slice(generateStart, endpointStart).indexOf('ensureLessonQuizKnowledge')).toBeLessThan(
      source.slice(generateStart, endpointStart).indexOf("if (!client)"),
    );
  });

  it('requires stored lesson_chunks while keeping the graph optional', async () => {
    const source = await readFile(adaptiveRouterUrl, 'utf8');
    expect(source).toContain(".from('lesson_chunks')");
    expect(source).toContain("access.artifact?.graph ?? { nodes: [], edges: [] }");
    expect(source).not.toContain('artifact.slide_summaries');
  });

  it('keeps mock mode development-only and uses strict ZenMux schemas in live mode', async () => {
    const serverSource = await readFile(serverUrl, 'utf8');
    const routerSource = await readFile(adaptiveRouterUrl, 'utf8');
    expect(serverSource).toContain("quizAiMode === 'mock' && process.env.NODE_ENV === 'production'");
    expect(routerSource).toContain("type: 'json_schema', json_schema: { name: schemaName, strict: true, schema }");
    expect(routerSource).toContain("mode === 'mock'");
    expect(routerSource).toContain("fallback_activated");
    expect(routerSource).toContain("router.get('/history'");
    expect(routerSource).toContain('serializeCompletedHistoryItem');
  });
});
