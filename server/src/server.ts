import { buildApp } from './app.js';
import { getEnv } from './config/env.js';

async function start() {
  const env = getEnv();
  const app = buildApp({
    storageMode: 'sqlite',
  });

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
