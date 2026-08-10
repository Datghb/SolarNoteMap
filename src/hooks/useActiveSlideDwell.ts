import { useEffect, useRef } from 'react';
import { createDwellClock, pauseDwellClock, readDwellSeconds, startDwellClock, type DwellClock } from '../utils/quizBehavior';

export function useActiveSlideDwell({
  enabled,
  lessonId,
  slideNumber,
  onComplete,
}: {
  enabled: boolean;
  lessonId: string;
  slideNumber: number;
  onComplete: (signal: { slideNumber: number; activeSeconds: number; revisitCount: number }) => void;
}) {
  const callbackRef = useRef(onComplete);
  const visitsRef = useRef<Record<number, number>>({});
  callbackRef.current = onComplete;

  useEffect(() => {
    visitsRef.current = {};
  }, [lessonId]);

  useEffect(() => {
    if (!enabled) return;
    let clock: DwellClock = createDwellClock();
    let disposed = false;
    let reportedSeconds = 0;
    visitsRef.current[slideNumber] = (visitsRef.current[slideNumber] ?? 0) + 1;

    const shouldRun = () => document.visibilityState === 'visible' && document.hasFocus();
    const synchronize = () => {
      const now = performance.now();
      clock = shouldRun() ? startDwellClock(clock, now) : pauseDwellClock(clock, now);
    };
    const reportElapsed = (minimumSeconds: number) => {
      const totalSeconds = readDwellSeconds(clock, performance.now());
      const activeSeconds = totalSeconds - reportedSeconds;
      if (activeSeconds < minimumSeconds) return;
      reportedSeconds = totalSeconds;
      callbackRef.current({
        slideNumber,
        activeSeconds,
        revisitCount: Math.max(0, (visitsRef.current[slideNumber] ?? 1) - 1),
      });
    };
    const finish = () => {
      if (disposed) return;
      disposed = true;
      clock = pauseDwellClock(clock, performance.now());
      reportElapsed(1);
    };

    synchronize();
    const checkpointTimer = window.setInterval(() => reportElapsed(30), 1_000);
    document.addEventListener('visibilitychange', synchronize);
    window.addEventListener('focus', synchronize);
    window.addEventListener('blur', synchronize);
    return () => {
      document.removeEventListener('visibilitychange', synchronize);
      window.removeEventListener('focus', synchronize);
      window.removeEventListener('blur', synchronize);
      window.clearInterval(checkpointTimer);
      finish();
    };
  }, [enabled, lessonId, slideNumber]);
}
