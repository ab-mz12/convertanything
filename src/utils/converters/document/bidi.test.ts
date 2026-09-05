import { describe, expect, it } from 'vitest';
import { hasRtlText, paragraphDirection, toVisualOrder } from './bidi';

describe('hasRtlText / paragraphDirection', () => {
  it('detects Arabic and Hebrew', () => {
    expect(hasRtlText('hello')).toBe(false);
    expect(hasRtlText('مرحبا')).toBe(true);
    expect(hasRtlText('שלום')).toBe(true);
    expect(hasRtlText('ARB 101 (مهارات)')).toBe(true);
  });

  it('uses the first strong character to decide the paragraph direction', () => {
    expect(paragraphDirection('Hello world')).toBe('ltr');
    expect(paragraphDirection('مرحبا بالعالم')).toBe('rtl');
    expect(paragraphDirection('1. مرحبا')).toBe('rtl');
    expect(paragraphDirection('Instructor: د. غيداء')).toBe('ltr');
    expect(paragraphDirection('د. غيداء (Instructor)')).toBe('rtl');
    expect(paragraphDirection('123')).toBe('ltr');
  });
});

describe('toVisualOrder', () => {
  it('leaves pure LTR text untouched', () => {
    expect(toVisualOrder('Hello, world (1)', 'ltr')).toBe('Hello, world (1)');
  });

  it('reverses an Arabic-only run and keeps digits readable', () => {
    expect(toVisualOrder('ابج', 'rtl')).toBe('جبا');
    expect(toVisualOrder('ابج 123', 'rtl')).toBe('123 جبا');
  });

  it('keeps Latin words in reading order inside an LTR line', () => {
    const visual = toVisualOrder('Name: ابج done', 'ltr');
    expect(visual).toBe('Name: جبا done');
  });

  it('mirrors brackets that end up in RTL runs', () => {
    expect(toVisualOrder('(ابج)', 'rtl')).toBe('(جبا)');
  });
});
