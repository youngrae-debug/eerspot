import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { AppError } from '../../lib/http/errors.js';
import type { AuthService } from '../auth/service.js';
import type { LinkPlaceDiscoveryService } from './link-discovery.js';
import type { PlacesService } from './service.js';

const searchQuerySchema = z.object({
  query: z.string().trim().min(1),
});

const discoverLinkSchema = z.object({
  url: z.string().trim().url(),
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

const updatePlaceSchema = z
  .object({
    note: z.union([z.string(), z.null()]).optional(),
    isFavorite: z.boolean().optional(),
  })
  .refine(
    body => body.note !== undefined || body.isFavorite !== undefined,
    {
      message: 'at least one field is required',
    },
  );

type PlacesRoutesOptions = {
  authService: AuthService;
  placesService: PlacesService;
  linkPlaceDiscoveryService?: LinkPlaceDiscoveryService;
  schedulesService?: {
    hasActiveSchedulesForPlace: (userId: string, placeId: string) => boolean;
  };
};

export const placesRoutes: FastifyPluginAsync<PlacesRoutesOptions> = async (
  app,
  { authService, placesService, linkPlaceDiscoveryService, schedulesService },
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

  app.post('/discover-link', async request => {
    await authService.authenticate(request.headers.authorization);

    if (!linkPlaceDiscoveryService) {
      throw new AppError(
        503,
        'LINK_DISCOVERY_UNAVAILABLE',
        'link discovery is not configured',
      );
    }

    const body = discoverLinkSchema.parse(request.body);
    const data = await linkPlaceDiscoveryService.analyze(body.url);

    return { data };
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

  app.patch('/:id', async request => {
    const viewer = await authService.authenticate(request.headers.authorization);
    const params = placeIdParamsSchema.parse(request.params);
    const body = updatePlaceSchema.parse(request.body);
    const data = await placesService.updatePlace({
      ...body,
      userId: viewer.id,
      placeId: params.id,
    });

    return { data };
  });

  app.delete('/:id', async (request, reply) => {
    const viewer = await authService.authenticate(request.headers.authorization);
    const params = placeIdParamsSchema.parse(request.params);

    if (schedulesService?.hasActiveSchedulesForPlace(viewer.id, params.id)) {
      throw new AppError(
        409,
        'PLACE_IN_USE',
        'linked schedules must be cleared before deleting this place',
      );
    }

    await placesService.deletePlace(viewer.id, params.id);

    return reply.code(204).send();
  });
};
