import { describe, expect, it } from 'vitest';
import { getSolarOrbit } from './solarOrbit';

describe('getSolarOrbit', () => {
  it('uses the real orbital periods of the eight planets in Earth days', () => {
    expect(Array.from({ length: 8 }, (_, index) => getSolarOrbit(index).orbitalPeriodDays)).toEqual([
      87.97,
      224.7,
      365.26,
      686.98,
      4332.59,
      10759.22,
      30688.5,
      60182,
    ]);
  });

  it('repeats the solar-system sequence for courses with more than eight lessons', () => {
    expect(getSolarOrbit(8)).toEqual(getSolarOrbit(0));
  });
});
