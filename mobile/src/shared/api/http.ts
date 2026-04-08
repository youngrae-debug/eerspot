import { env } from '../config/env';

const REQUEST_TIMEOUT_MS = 10000;

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
};

type SuccessEnvelope<T> = {
  data: T;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.details = input.details;
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string;
};

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('request timeout');
    }

    if (error instanceof Error && error.message === 'Network request failed') {
      throw new Error(
        `cannot reach api server (${env.apiBaseUrl}); verify server is running and reachable from device`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as SuccessEnvelope<T> | ErrorEnvelope;

  if (!response.ok) {
    const errorEnvelope = payload as ErrorEnvelope;

    throw new ApiError({
      status: response.status,
      code: errorEnvelope.error.code,
      message: errorEnvelope.error.message,
      requestId: errorEnvelope.error.requestId,
      details: errorEnvelope.error.details,
    });
  }

  return (payload as SuccessEnvelope<T>).data;
}
