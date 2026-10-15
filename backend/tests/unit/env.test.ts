import { loadEnv } from '../../src/config/env';

describe('loadEnv', () => {
  it('applies defaults', () => {
    expect(loadEnv({})).toEqual({
      PORT: 4000,
      DATABASE_PATH: './data/tickets.db',
      CORS_ORIGIN: 'http://localhost:3000',
      OPENAI_API_KEY: undefined,
      OPENAI_MODEL: 'gpt-5-mini',
      AI_TIMEOUT_MS: 8000,
    });
  });
  it('coerces numbers', () => {
    expect(loadEnv({ PORT: '5001', AI_TIMEOUT_MS: '2500' })).toMatchObject({ PORT: 5001, AI_TIMEOUT_MS: 2500 });
  });
  it('fails fast on invalid values with a readable message', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow(/Invalid environment configuration: PORT/);
  });
});
