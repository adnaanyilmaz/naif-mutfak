import { describe, expect, it } from 'vitest';
import { translateInputSchema, translationReportSchema } from './translation';

const POST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('translateInputSchema', () => {
  it('only targets en/ar and defaults overwrite to false', () => {
    expect(translateInputSchema.safeParse({ postId: POST, locale: 'tr' }).success).toBe(false);
    expect(translateInputSchema.parse({ postId: POST, locale: 'ar' })).toEqual({ postId: POST, locale: 'ar', overwrite: false });
  });
});

describe('translationReportSchema', () => {
  it('rejects unknown check codes', () => {
    const report = { checks: [{ code: 'numbers', field: 'bodyMd' }], review: [], reviewed: true };
    expect(translationReportSchema.safeParse(report).success).toBe(true);
    expect(translationReportSchema.safeParse({ ...report, checks: [{ code: 'nope', field: 'x' }] }).success).toBe(false);
  });
});
