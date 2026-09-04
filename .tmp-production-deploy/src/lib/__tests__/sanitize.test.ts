import { describe, it, expect } from 'vitest';
import { escapeIlikePattern } from '../sanitize';

describe('escapeIlikePattern', () => {
  it('returns plain text unchanged', () => {
    expect(escapeIlikePattern('hello')).toBe('hello');
  });

  it('escapes percent sign', () => {
    expect(escapeIlikePattern('100%')).toBe('100\\%');
  });

  it('escapes underscore', () => {
    expect(escapeIlikePattern('a_b')).toBe('a\\_b');
  });

  it('escapes backslash', () => {
    expect(escapeIlikePattern('c:\\dir')).toBe('c:\\\\dir');
  });

  it('escapes all special chars together', () => {
    expect(escapeIlikePattern('%_\\')).toBe('\\%\\_\\\\');
  });

  it('handles empty string', () => {
    expect(escapeIlikePattern('')).toBe('');
  });
});
