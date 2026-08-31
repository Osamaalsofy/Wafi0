import { validateEnvironment } from './environment';

const baseConfig = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://wafi:secret@postgres:5432/wafi_os',
  CORS_ORIGINS: 'https://app.example.com,https://admin.example.com:8443',
  JWT_ACCESS_SECRET: 'a-production-secret-with-32-characters',
  DOCUMENT_STORAGE_PROVIDER: 's3',
  S3_BUCKET: 'wafi-production-documents',
};

describe('validateEnvironment', () => {
  it('accepts explicit HTTPS origins and a non-placeholder production secret', () => {
    const environment = validateEnvironment(baseConfig);

    expect(environment.NODE_ENV).toBe('production');
    expect(environment.CORS_ORIGINS).toBe(baseConfig.CORS_ORIGINS);
  });

  it.each([
    '*',
    'http://app.example.com',
    'https://user:password@app.example.com',
    'https://app.example.com/path',
    'https://app.example.com?tenant=wafi',
  ])('rejects unsafe production CORS origin %s', (origin) => {
    expect(() => validateEnvironment({ ...baseConfig, CORS_ORIGINS: origin })).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it.each([
    'replace-with-at-least-32-random-characters',
    'change-me-production-secret-32-characters',
    'production-placeholder-secret-32-characters',
  ])('rejects production JWT placeholder %s', (secret) => {
    expect(() => validateEnvironment({ ...baseConfig, JWT_ACCESS_SECRET: secret })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('keeps local HTTP origins available outside production', () => {
    expect(
      validateEnvironment({
        ...baseConfig,
        NODE_ENV: 'development',
        CORS_ORIGINS: 'http://localhost:3000',
        JWT_ACCESS_SECRET: 'replace-with-at-least-32-random-characters',
      }).CORS_ORIGINS,
    ).toBe('http://localhost:3000');
  });

  it('parses explicit false boolean environment values without enabling them', () => {
    const environment = validateEnvironment({
      ...baseConfig,
      BACKGROUND_JOBS_ENABLED: 'false',
      S3_FORCE_PATH_STYLE: 'false',
    });

    expect(environment.BACKGROUND_JOBS_ENABLED).toBe(false);
    expect(environment.S3_FORCE_PATH_STYLE).toBe(false);
  });

  it('treats blank optional provider values from Compose as unset', () => {
    const environment = validateEnvironment({
      ...baseConfig,
      S3_ENDPOINT: '',
      S3_ACCESS_KEY_ID: '',
      S3_SECRET_ACCESS_KEY: '',
    });

    expect(environment.S3_ENDPOINT).toBeUndefined();
    expect(environment.S3_ACCESS_KEY_ID).toBeUndefined();
    expect(environment.S3_SECRET_ACCESS_KEY).toBeUndefined();
  });
});
