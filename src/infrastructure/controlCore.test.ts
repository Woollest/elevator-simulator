import { describe, expect, it } from 'vitest';
import { fallbackShouldStop } from './controlCore';

describe('collective-control fallback', () => {
  it.each([
    [1, false, false, false], [1, true, false, true], [1, false, true, false], [1, true, true, true],
    [-1, false, false, false], [-1, true, false, false], [-1, false, true, true], [-1, true, true, true]
  ] as const)('direction=%i up=%s down=%s', (direction, up, down, expected) => {
    expect(fallbackShouldStop(direction, { up, down })).toBe(expected);
  });
});
