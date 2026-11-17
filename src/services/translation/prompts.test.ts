import { describe, expect, it } from 'vitest';
import { BODY_CHUNK_CHARS, bodyPrompt, payloadPrompt, reviewPrompt, splitBody } from './prompts';
import { enPayload, trSource } from './fixtures';

const para = (n: number, len = 1000) => `${String(n).padStart(4, '0')} ${'x'.repeat(len - 5)}`;

describe('splitBody', () => {
  it('returns no chunks for a blank body and one for a short body', () => {
    expect(splitBody('  \n ')).toEqual([]);
    expect(splitBody('## A\n\nText')).toEqual(['## A\n\nText']);
  });

  it('packs blocks into chunks within the limit that join back to the original', () => {
    const body = Array.from({ length: 30 }, (_, i) => para(i)).join('\n\n');
    const chunks = splitBody(body);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(BODY_CHUNK_CHARS);
    expect(chunks.join('\n\n')).toBe(body);
  });

  it('never splits inside a fenced code block or a ::: container', () => {
    const fence = '```\n' + Array.from({ length: 4 }, (_, i) => para(i, 900)).join('\n\n') + '\n```';
    const container = ':::note\n' + Array.from({ length: 4 }, (_, i) => para(i, 900)).join('\n\n') + '\n:::';
    const body = [...Array.from({ length: 9 }, (_, i) => para(i)), fence, container, para(99)].join('\n\n');
    const chunks = splitBody(body);
    expect(chunks.join('\n\n')).toBe(body);
    expect(chunks.some((c) => c.includes(fence))).toBe(true);
    expect(chunks.some((c) => c.includes(container))).toBe(true);
  });
});

describe('prompts', () => {
  it('names the target language and carries the input', () => {
    const p = payloadPrompt('ar', enPayload());
    expect(p.system).toContain('Modern Standard Arabic');
    expect(JSON.parse(p.user)).toEqual(enPayload());
    expect(bodyPrompt('en', '## A').system).toContain('English');
    expect(bodyPrompt('en', '## A').user).toBe('## A');
  });

  it('review prompt truncates the body and includes automated checks', () => {
    const long = { ...trSource, bodyMd: 'x'.repeat(20_000) };
    const r = reviewPrompt('en', long, { ...long, locale: 'en' }, [{ code: 'numbers', field: 'bodyMd' }]);
    const user: unknown = JSON.parse(r.user);
    expect(r.system).toContain('written in Turkish');
    expect(JSON.stringify(user).length).toBeLessThan(20_000);
    expect(r.user).toContain('"numbers"');
  });
});
