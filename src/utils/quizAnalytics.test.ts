import { describe, expect, it } from 'vitest';
import { parseAdaptiveQuizAnalytics } from './quizAnalytics';

describe('adaptive quiz analytics parser', () => {
  it('accepts non-negative Phase 2 aggregates', () => {
    const analytics = parseAdaptiveQuizAnalytics({
      recommendationCount: 10, acceptedCount: 8, completedCount: 7, dismissedCount: 2,
      acceptanceRate: 0.8, completionRate: 0.875, averageScorePercent: 0.7,
      averageDurationSeconds: 180, reportedQuestionCount: 1, verifierRetryRate: 0.2,
      averageGenerationLatencyMs: 2500,
    });
    expect(analytics).toMatchObject({ completedCount: 7, acceptanceRate: 0.8 });
  });

  it('rejects incomplete or negative aggregates', () => {
    expect(() => parseAdaptiveQuizAnalytics({ recommendationCount: -1 })).toThrow(/không hợp lệ/);
  });
});
