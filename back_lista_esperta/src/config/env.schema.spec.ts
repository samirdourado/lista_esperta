import { validateEnv } from './env.schema.js';

const valid = {
  DATABASE_URL: 'postgresql://lista:lista@localhost:5433/lista_esperta',
  FRONTEND_URL: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(3333);
    expect(env.NODE_ENV).toBe('development');
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.JWT_REFRESH_TTL_DAYS).toBe(7);
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('uses secure cookies in production unless told otherwise', () => {
    expect(
      validateEnv({ ...valid, NODE_ENV: 'production' }).COOKIE_SECURE,
    ).toBe(true);
    expect(
      validateEnv({ ...valid, NODE_ENV: 'production', COOKIE_SECURE: 'false' })
        .COOKIE_SECURE,
    ).toBe(false);
  });

  it('treats empty strings as missing', () => {
    const env = validateEnv({ ...valid, GEMINI_API_KEY: '' });
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });

  it('fails when a required variable is missing', () => {
    const rest: Record<string, string> = { ...valid };
    delete rest.DATABASE_URL;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('rejects short or identical JWT secrets', () => {
    expect(() => validateEnv({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
    expect(() =>
      validateEnv({ ...valid, JWT_REFRESH_SECRET: valid.JWT_ACCESS_SECRET }),
    ).toThrow(/must differ/);
  });
});
