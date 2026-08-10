import { describe, expect, it } from 'vitest';
import {
  addQuizDwell,
  addQuizKeyword,
  createDwellClock,
  createQuizBehaviorState,
  deriveAdaptiveQuizContext,
  markQuizSlideUnclear,
  pauseDwellClock,
  readDwellSeconds,
  startDwellClock,
} from './quizBehavior';

describe('adaptive quiz behavior', () => {
  it('does not count time while the dwell clock is paused', () => {
    let clock = createDwellClock();
    clock = startDwellClock(clock, 1_000);
    clock = pauseDwellClock(clock, 6_500);
    expect(readDwellSeconds(clock, 20_000)).toBe(5);
    clock = startDwellClock(clock, 20_000);
    expect(readDwellSeconds(clock, 23_000)).toBe(8);
  });

  it('deduplicates keyword signals and waits for enough active dwell', () => {
    let state = createQuizBehaviorState(12);
    state = addQuizKeyword(state, 'Context Window');
    state = addQuizKeyword(state, ' context   window ');
    state = addQuizDwell(state, { slideNumber: 12, activeSeconds: 29, revisitCount: 0 });
    expect(state.keywords).toEqual(['Context Window']);
    expect(deriveAdaptiveQuizContext(state).eligible).toBe(false);
    state = addQuizDwell(state, { slideNumber: 12, activeSeconds: 2, revisitCount: 1 });
    expect(deriveAdaptiveQuizContext(state)).toMatchObject({ eligible: true, activeSeconds: 31, targetSlides: [12] });
  });

  it('prioritizes slides explicitly marked unclear', () => {
    let state = createQuizBehaviorState(3);
    state = addQuizDwell(state, { slideNumber: 3, activeSeconds: 35, revisitCount: 0 });
    state = markQuizSlideUnclear(state, 7);
    const context = deriveAdaptiveQuizContext(state);
    expect(context.eligible).toBe(true);
    expect(context.targetSlides[0]).toBe(7);
    expect(context.reasons).toContain('slide_marked_unclear');
  });
});
