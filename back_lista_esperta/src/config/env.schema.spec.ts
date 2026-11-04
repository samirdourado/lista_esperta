import { validateEnv } from './env.schema.js';

const valid = {
  DATABASE_URL: 'postgresql://lista:lista@localhost:5433/lista_esperta',
  FRONTEND_URL: 'http://localhost:3000',
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(3333);
    expect(env.NODE_ENV).toBe('development');
  });

  it('treats empty strings as missing', () => {
    const env = validateEnv({ ...valid, GEMINI_API_KEY: '' });
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });

  it('fails when a required variable is missing', () => {
    expect(() => validateEnv({ FRONTEND_URL: valid.FRONTEND_URL })).toThrow(
      /DATABASE_URL/,
    );
  });
});
