import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { AuthService } from './service.js';

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

type AuthRoutesOptions = {
  authService: AuthService;
};

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  { authService },
) => {
  app.post('/signup', async (request, reply) => {
    const body = credentialsSchema.parse(request.body);
    const data = await authService.signUp(body);

    return reply.code(201).send({ data });
  });

  app.post('/login', async request => {
    const body = credentialsSchema.parse(request.body);
    const data = await authService.login(body);

    return { data };
  });

  app.post('/refresh', async request => {
    const body = refreshTokenSchema.parse(request.body);
    const data = await authService.refresh(body);

    return { data };
  });

  app.post('/logout', async (request, reply) => {
    const body = refreshTokenSchema.parse(request.body);
    await authService.logout(body);

    return reply.code(204).send();
  });
};
