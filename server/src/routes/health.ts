import type { FastifyPluginAsync } from 'fastify';

import type { AppEnv } from '../config/env.js';

type HealthRoutesOptions = {
  env: AppEnv;
};

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (
  app,
  { env },
) => {
  app.get('/health', async request => {
    return {
      data: {
        name: 'eerspot-server',
        env: env.APP_ENV,
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    };
  });
};
