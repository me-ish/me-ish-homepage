import { describe, it, expect } from 'vitest';
import { safeCompare } from '../timingSafe';

describe('safeCompare', () => {
  it('returns true for matching strings', () => {
    expect(safeCompare('secret', 'secret')).toBe(true);
  });

  it('returns false for mismatched strings', () => {
    expect(safeCompare('secret', 'wrong')).toBe(false);
  });

  it('returns false for empty first argument', () => {
    expect(safeCompare('', 'secret')).toBe(false);
  });

  it('returns false for empty second argument', () => {
    expect(safeCompare('secret', '')).toBe(false);
  });

  it('returns false for both empty', () => {
    expect(safeCompare('', '')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(safeCompare('short', 'longer-string')).toBe(false);
  });

  it('returns true for identical long strings', () => {
    const long = 'a'.repeat(1000);
    expect(safeCompare(long, long)).toBe(true);
  });
});
