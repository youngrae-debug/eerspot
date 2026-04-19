import Fastify from 'fastify';
import cors from '@fastify/cors';

import { getEnv } from './config/env.js';
import { openAppDatabase } from './lib/sqlite.js';
import { registerErrorHandler } from './lib/http/error-handler.js';
import {
  authRoutes,
  AuthService,
  InMemoryAuthRepository,
  SQLiteAuthRepository,
} from './modules/auth/index.js';
import {
  InMemoryPlacesRepository,
  KakaoPlaceSearchClient,
  LinkPlaceDiscoveryService,
  PlacesService,
  SQLitePlacesRepository,
  StaticCatalogPlaceSearchClient,
  placesRoutes,
} from './modules/places/index.js';
import type { ImageOcrClient } from './modules/places/image-ocr.js';
import { VisionImageOcrClient } from './modules/places/image-ocr.js';
import {
  InMemorySchedulesRepository,
  SchedulesService,
  SQLiteSchedulesRepository,
  schedulesRoutes,
} from './modules/schedules/index.js';
import { healthRoutes } from './routes/health.js';

type BuildAppOptions = {
  databasePath?: string;
  env?: Partial<ReturnType<typeof getEnv>>;
  placeSearchClient?: {
    search: (query: string) => Promise<import('./modules/places/types.js').PlaceSearchResult[]>;
  };
  pageFetchImpl?: typeof fetch;
  imageOcrClient?: ImageOcrClient;
  storageMode?: 'memory' | 'sqlite';
};

export function buildApp(options: BuildAppOptions = {}) {
  const env = {
    ...getEnv(),
    ...options.env,
  };
  const storageMode = options.storageMode ?? 'memory';
  const database =
    storageMode === 'sqlite'
      ? openAppDatabase(options.databasePath ?? env.DATABASE_PATH)
      : null;
  const authRepository = database
    ? new SQLiteAuthRepository(database)
    : new InMemoryAuthRepository();
  const authService = new AuthService(authRepository);
  const placesRepository = database
    ? new SQLitePlacesRepository(database)
    : new InMemoryPlacesRepository(env.MAP_PROVIDER);
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
  const linkPlaceDiscoveryService = new LinkPlaceDiscoveryService(
    placeSearchClient,
    new StaticCatalogPlaceSearchClient(env.MAP_PROVIDER),
    options.pageFetchImpl ?? fetch,
    options.imageOcrClient ?? new VisionImageOcrClient(),
  );
  const schedulesRepository = database
    ? new SQLiteSchedulesRepository(database)
    : new InMemorySchedulesRepository();
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

  if (database) {
    app.addHook('onClose', async () => {
      database.close();
    });
  }

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
    linkPlaceDiscoveryService,
    placesService,
    schedulesService,
  });
  void app.register(schedulesRoutes, {
    prefix: '/api/v1/schedules',
    authService,
    schedulesService,
  });

  return app;
}
