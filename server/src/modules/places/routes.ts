import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { AuthService } from '../auth/service.js';
import type { PlacesService } from './service.js';

const searchQuerySchema = z.object({
  query: z.string().trim().min(1),
});

const createPlaceSchema = z.object({
  provider: z.enum(['naver', 'kakao', 'google']),
  providerPlaceId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const placeIdParamsSchema = z.object({
  id: z.string().uuid(),
});

type PlacesRoutesOptions = {
  authService: AuthService;
  placesService: PlacesService;
};

export const placesRoutes: FastifyPluginAsync<PlacesRoutesOptions> = async (
  app,
  { authService, placesService },
) => {
  app.get('/search', async request => {
    await authService.authenticate(request.headers.authorization);
    const query = searchQuerySchema.parse(request.query);
    const items = await placesService.searchPlaces(query.query);

    return {
      data: {
        items,
      },
    };
  });

  app.post('/', async (request, reply) => {
    const viewer = await authService.authenticate(request.headers.authorization);
    const body = createPlaceSchema.parse(request.body);
    const data = await placesService.savePlace({
      ...body,
      userId: viewer.id,
    });

    return reply.code(201).send({ data });
  });

  app.get('/', async request => {
    const viewer = await authService.authenticate(request.headers.authorization);
    const data = await placesService.listPlaces(viewer.id);

    return { data };
  });

  app.get('/:id', async request => {
    const viewer = await authService.authenticate(request.headers.authorization);
    const params = placeIdParamsSchema.parse(request.params);
    const data = await placesService.getPlace(viewer.id, params.id);

    return { data };
  });
};
