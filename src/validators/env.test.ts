import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseAiEnv, parseEnv } from './env';

const valid = {
  ENVIRONMENT: 'development',
  SITE_URL: 'http://localhost:3000',
  MEDIA_PUBLIC_URL: 'http://localhost:3000/media',
  PAYMENT_PROVIDER: 'lemonsqueezy',
};

describe('parseEnv', () => {
  it('accepts a valid env', () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it('ignores unknown keys such as bindings', () => {
    expect(parseEnv({ ...valid, DB: {} })).toEqual(valid);
  });

  it('rejects an invalid provider and a bad URL with all issues listed', () => {
    const run = () => parseEnv({ ...valid, PAYMENT_PROVIDER: 'stripe', SITE_URL: 'nope' });
    expect(run).toThrow(EnvValidationError);
    try {
      run();
    } catch (e) {
      expect(e instanceof EnvValidationError && e.issues.length).toBe(2);
    }
  });
});

describe('parseAiEnv', () => {
  it('parses AI model ids and rejects non-Workers-AI ids', () => {
    expect(
      parseAiEnv({ AI_TRANSLATE_MODEL: '@cf/google/gemma-4-26b-a4b-it', AI_REVIEW_MODEL: '@cf/zai-org/glm-4.7-flash' }).AI_REVIEW_MODEL,
    ).toBe('@cf/zai-org/glm-4.7-flash');
    expect(() => parseAiEnv({ AI_TRANSLATE_MODEL: 'gpt-4', AI_REVIEW_MODEL: '' })).toThrow(EnvValidationError);
  });
});
