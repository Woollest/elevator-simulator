export type Direction = 1 | -1;
export type HallCall = 'up' | 'down';
export type Calls = Readonly<{ up: boolean; down: boolean }>;

export const SIMULATION = Object.freeze({
  hallFloor: 12,
  minFloor: 1,
  maxFloor: 20,
  travelMs: { minimum: 1350, variance: 750 },
  intermediateStopProbability: 0.38,
  crowdedStopProbability: 0.28
});

export function callForDirection(direction: Direction): HallCall {
  return direction > 0 ? 'up' : 'down';
}
