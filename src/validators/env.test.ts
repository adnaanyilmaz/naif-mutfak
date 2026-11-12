import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from './env';

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
