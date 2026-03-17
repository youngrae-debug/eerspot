import Fastify from 'fastify';
import cors from '@fastify/cors';

import { getEnv } from './config/env.js';
import { registerErrorHandler } from './lib/http/error-handler.js';
import {
  authRoutes,
  AuthService,
  InMemoryAuthRepository,
} from './modules/auth/index.js';
import {
  InMemoryPlacesRepository,
  KakaoPlaceSearchClient,
  PlacesService,
  StaticCatalogPlaceSearchClient,
  placesRoutes,
} from './modules/places/index.js';
import {
  InMemorySchedulesRepository,
  SchedulesService,
  schedulesRoutes,
} from './modules/schedules/index.js';
import { healthRoutes } from './routes/health.js';

type BuildAppOptions = {
  env?: ReturnType<typeof getEnv>;
  placeSearchClient?: {
    search: (query: string) => Promise<import('./modules/places/types.js').PlaceSearchResult[]>;
  };
};

export function buildApp(options: BuildAppOptions = {}) {
  const env = options.env ?? getEnv();
  const authRepository = new InMemoryAuthRepository();
  const authService = new AuthService(authRepository);
  const placesRepository = new InMemoryPlacesRepository(env.MAP_PROVIDER);
  const placeSearchClient =
    options.placeSearchClient ??
    (env.MAP_PROVIDER === 'kakao'
      ? new KakaoPlaceSearchClient(env.KAKAO_REST_API_KEY ?? '')
      : new StaticCatalogPlaceSearchClient(env.MAP_PROVIDER));
  const placesService = new PlacesService(
    placesRepository,
    env.MAP_PROVIDER,
    placeSearchClient,
  );
  const schedulesRepository = new InMemorySchedulesRepository();
  const schedulesService = new SchedulesService(
    schedulesRepository,
    placesService,
  );

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  const corsOrigin =
    env.CORS_ORIGIN === '*'
      ? true
      : env.CORS_ORIGIN.split(',').map(origin => origin.trim());

  void app.register(cors, {
    origin: corsOrigin,
  });

  registerErrorHandler(app);

  void app.register(healthRoutes, { env });
  void app.register(healthRoutes, { prefix: '/api/v1', env });
  void app.register(authRoutes, {
    prefix: '/api/v1/auth',
    authService,
  });
  void app.register(placesRoutes, {
    prefix: '/api/v1/places',
    authService,
    placesService,
  });
  void app.register(schedulesRoutes, {
    prefix: '/api/v1/schedules',
    authService,
    schedulesService,
  });

  return app;
}
