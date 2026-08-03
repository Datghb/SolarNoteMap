export interface SolarOrbit {
  orbitalPeriodDays: number;
}

// Sidereal orbital periods, measured in Earth days, from Mercury to Neptune.
const SOLAR_ORBITS: readonly SolarOrbit[] = Object.freeze([
  { orbitalPeriodDays: 87.97 },
  { orbitalPeriodDays: 224.7 },
  { orbitalPeriodDays: 365.26 },
  { orbitalPeriodDays: 686.98 },
  { orbitalPeriodDays: 4332.59 },
  { orbitalPeriodDays: 10759.22 },
  { orbitalPeriodDays: 30688.5 },
  { orbitalPeriodDays: 60182 },
]);

export function getSolarOrbit(index: number): SolarOrbit {
  const normalizedIndex = Math.abs(Math.trunc(index)) % SOLAR_ORBITS.length;
  return { ...SOLAR_ORBITS[normalizedIndex] };
}
