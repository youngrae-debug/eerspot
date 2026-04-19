import { request } from '../src/shared/api/http';

describe('request', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.resetAllMocks();
  });

  test('does not send application/json content-type when there is no body', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    globalThis.fetch = fetchMock as typeof fetch;

    await request('/places/place-id', {
      method: 'DELETE',
      accessToken: 'token',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/places/place-id'),
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer token',
        },
      }),
    );
  });

  test('sends application/json content-type when there is a body', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        data: {
          ok: true,
        },
      }),
      ok: true,
      status: 200,
    });

    globalThis.fetch = fetchMock as typeof fetch;

    await request('/places', {
      method: 'POST',
      body: {
        name: 'Cafe Alpha',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/places'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Cafe Alpha',
        }),
      }),
    );
  });
});
