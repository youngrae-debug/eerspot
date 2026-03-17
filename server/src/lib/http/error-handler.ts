import { ZodError } from 'zod';

import { AppError } from './errors.js';

export function registerErrorHandler(app: {
  setErrorHandler: (
    handler: (
      error: Error,
      request: { id: string; log: { error: (error: unknown) => void } },
      reply: {
        status: (code: number) => { send: (body: unknown) => void };
      },
    ) => void,
  ) => void;
}) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'request validation failed',
          requestId: request.id,
          details: error.flatten(),
        },
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
          ...(error.details ? { details: error.details } : {}),
        },
      });
    }

    request.log.error(error);

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'internal server error',
        requestId: request.id,
      },
    });
  });
}
