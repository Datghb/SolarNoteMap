export interface QuizDwellSignal {
  slideNumber: number;
  activeSeconds: number;
  revisitCount: number;
}

export interface QuizBehaviorState {
  keywords: string[];
  weakKeywords: string[];
  dwellBySlide: Record<number, QuizDwellSignal>;
  unclearSlides: number[];
  latestSlide: number;
}

export interface AdaptiveQuizContext {
  eligible: boolean;
  activeSeconds: number;
  targetKeywords: string[];
  targetSlides: number[];
  unclearSlides: number[];
  currentSlide: number;
  reasons: string[];
  signature: string;
}

export interface DwellClock {
  accumulatedMs: number;
  runningSince: number | null;
}

function cleanKeyword(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function normalizedKeyword(value: string) {
  return cleanKeyword(value).toLocaleLowerCase('vi');
}

export function createQuizBehaviorState(slideNumber = 1): QuizBehaviorState {
  return { keywords: [], weakKeywords: [], dwellBySlide: {}, unclearSlides: [], latestSlide: slideNumber };
}

export function addQuizWrongKeywords(state: QuizBehaviorState, keywordValues: string[]): QuizBehaviorState {
  const seen = new Set(state.weakKeywords.map(normalizedKeyword));
  const additions = (Array.isArray(keywordValues) ? keywordValues : []).flatMap((value) => {
    const keyword = cleanKeyword(value).slice(0, 80);
    const normalized = normalizedKeyword(keyword);
    if (!keyword || seen.has(normalized)) return [];
    seen.add(normalized);
    return [keyword];
  });
  return additions.length ? { ...state, weakKeywords: [...state.weakKeywords, ...additions].slice(-8) } : state;
}

export function addQuizKeyword(state: QuizBehaviorState, keywordValue: string): QuizBehaviorState {
  const keyword = cleanKeyword(keywordValue).slice(0, 80);
  if (!keyword || state.keywords.some((item) => normalizedKeyword(item) === normalizedKeyword(keyword))) return state;
  return { ...state, keywords: [...state.keywords, keyword].slice(-5) };
}

export function addQuizDwell(state: QuizBehaviorState, signal: QuizDwellSignal): QuizBehaviorState {
  const slideNumber = Math.round(signal.slideNumber);
  const activeSeconds = Math.max(0, Math.min(86_400, Math.round(signal.activeSeconds)));
  if (slideNumber < 1 || slideNumber > 500 || activeSeconds < 1) return state;
  const previous = state.dwellBySlide[slideNumber];
  return {
    ...state,
    latestSlide: slideNumber,
    dwellBySlide: {
      ...state.dwellBySlide,
      [slideNumber]: {
        slideNumber,
        activeSeconds: Math.min(86_400, (previous?.activeSeconds ?? 0) + activeSeconds),
        revisitCount: Math.max(previous?.revisitCount ?? 0, signal.revisitCount),
      },
    },
  };
}

export function markQuizSlideUnclear(state: QuizBehaviorState, slideNumberValue: number): QuizBehaviorState {
  const slideNumber = Math.round(slideNumberValue);
  if (slideNumber < 1 || slideNumber > 500 || state.unclearSlides.includes(slideNumber)) return state;
  return { ...state, latestSlide: slideNumber, unclearSlides: [...state.unclearSlides, slideNumber].slice(-10) };
}

export function createDwellClock(): DwellClock {
  return { accumulatedMs: 0, runningSince: null };
}

export function startDwellClock(clock: DwellClock, now: number): DwellClock {
  if (clock.runningSince !== null) return clock;
  return { ...clock, runningSince: now };
}

export function pauseDwellClock(clock: DwellClock, now: number): DwellClock {
  if (clock.runningSince === null) return clock;
  return { accumulatedMs: clock.accumulatedMs + Math.max(0, now - clock.runningSince), runningSince: null };
}

export function readDwellSeconds(clock: DwellClock, now: number) {
  const elapsed = clock.accumulatedMs + (clock.runningSince === null ? 0 : Math.max(0, now - clock.runningSince));
  return Math.floor(elapsed / 1000);
}

export function deriveAdaptiveQuizContext(state: QuizBehaviorState, thresholdSeconds = 30): AdaptiveQuizContext {
  const dwell = Object.values(state.dwellBySlide);
  const activeSeconds = dwell.reduce((total, signal) => total + signal.activeSeconds, 0);
  const scoredSlides = new Map<number, number>();
  for (const signal of dwell) {
    scoredSlides.set(signal.slideNumber, (signal.activeSeconds >= thresholdSeconds ? 1 : 0) + Math.min(2, signal.revisitCount));
  }
  for (const slide of state.unclearSlides) scoredSlides.set(slide, (scoredSlides.get(slide) ?? 0) + 4);
  if (state.latestSlide >= 1) scoredSlides.set(state.latestSlide, (scoredSlides.get(state.latestSlide) ?? 0) + 1);
  const targetSlides = [...scoredSlides.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])
    .slice(0, 5)
    .map(([slide]) => slide);
  const reasons = [];
  if (state.keywords.length) reasons.push('keyword_opened');
  if (state.weakKeywords.length) reasons.push('wrong_answer_history');
  if (state.unclearSlides.length) reasons.push('slide_marked_unclear');
  if (activeSeconds >= thresholdSeconds) reasons.push('active_dwell');
  const eligible = activeSeconds >= thresholdSeconds && Boolean(state.keywords.length || state.unclearSlides.length || state.weakKeywords.length);
  const targetKeywords = [...state.weakKeywords.slice(-3), ...state.keywords.slice(-3)]
    .filter((keyword, index, values) => values.findIndex((candidate) => normalizedKeyword(candidate) === normalizedKeyword(keyword)) === index)
    .slice(0, 5);
  const signature = JSON.stringify({
    keywords: targetKeywords.map(normalizedKeyword).sort(),
    slides: [...targetSlides].sort((a, b) => a - b),
    unclear: [...state.unclearSlides].sort((a, b) => a - b),
  });
  return {
    eligible,
    activeSeconds,
    targetKeywords,
    targetSlides: targetSlides.length ? targetSlides : [Math.max(1, state.latestSlide)],
    unclearSlides: [...state.unclearSlides],
    currentSlide: Math.max(1, state.latestSlide),
    reasons,
    signature,
  };
}
