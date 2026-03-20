import { config as loadDotenv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);
const serverRootPath = resolve(currentDirPath, '../..');
const workspaceRootPath = resolve(serverRootPath, '..');

loadDotenv({
  path: resolve(workspaceRootPath, '.env'),
  quiet: true,
});

loadDotenv({
  override: true,
  path: resolve(serverRootPath, '.env'),
  quiet: true,
});

const envSchema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ENV: z.enum(['dev', 'staging', 'prod']).default('dev'),
  MAP_PROVIDER: z.enum(['naver', 'kakao', 'google']).default('kakao'),
  KAKAO_REST_API_KEY: z.string().optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  CORS_ORIGIN: z.string().default('*'),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}
