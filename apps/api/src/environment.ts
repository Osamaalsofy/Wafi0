import { z } from 'zod';

const environmentBoolean = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return value;
}, z.boolean());

const optionalEnvironmentString = (schema: z.ZodString) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z.string().url().startsWith('postgresql://'),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    RATE_LIMIT_TTL_MS: z.coerce.number().int().min(1000).default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
    DOCUMENT_STORAGE_LOCAL_PATH: z.string().min(1).default('./var/documents'),
    DOCUMENT_MAX_SIZE_BYTES: z.coerce.number().int().min(1).max(50_000_000).default(10_000_000),
    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    BACKGROUND_JOBS_ENABLED: environmentBoolean.default(true),
    FAILED_JOB_ALERT_THRESHOLD: z.coerce.number().int().min(1).default(1),
    DOCUMENT_STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    S3_ENDPOINT: optionalEnvironmentString(z.string().url()),
    S3_REGION: z.string().min(1).default('me-central-1'),
    S3_BUCKET: optionalEnvironmentString(z.string().min(3)),
    S3_ACCESS_KEY_ID: optionalEnvironmentString(z.string().min(1)),
    S3_SECRET_ACCESS_KEY: optionalEnvironmentString(z.string().min(1)),
    S3_FORCE_PATH_STYLE: environmentBoolean.default(false),
    DOCUMENT_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  })
  .superRefine((config, context) => {
    if (config.NODE_ENV !== 'production') return;

    if (config.DOCUMENT_STORAGE_PROVIDER !== 's3') {
      context.addIssue({
        code: 'custom',
        path: ['DOCUMENT_STORAGE_PROVIDER'],
        message: 'Production document storage must use s3',
      });
    }
    if (!config.S3_BUCKET)
      context.addIssue({
        code: 'custom',
        path: ['S3_BUCKET'],
        message: 'S3_BUCKET is required in production',
      });

    const normalizedSecret = config.JWT_ACCESS_SECRET.toLowerCase();
    if (
      ['replace-with', 'change-me', 'placeholder'].some((value) => normalizedSecret.includes(value))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT_ACCESS_SECRET must not contain a placeholder value in production',
      });
    }

    for (const origin of config.CORS_ORIGINS.split(',').map((value) => value.trim())) {
      if (!origin || origin === '*') {
        context.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: 'Production CORS origins must be explicit HTTPS origins',
        });
        continue;
      }

      try {
        const parsed = new URL(origin);
        if (
          parsed.protocol !== 'https:' ||
          parsed.origin !== origin ||
          parsed.username ||
          parsed.password
        ) {
          context.addIssue({
            code: 'custom',
            path: ['CORS_ORIGINS'],
            message: 'Production CORS origins must be origin-only HTTPS URLs',
          });
        }
      } catch {
        context.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: 'Production CORS origins must be valid URLs',
        });
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }
  return result.data;
}
