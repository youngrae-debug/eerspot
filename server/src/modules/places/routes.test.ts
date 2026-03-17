import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../../app.js';

async function createAuthenticatedHeader(app: ReturnType<typeof buildApp>) {
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: {
      email: 'places@example.com',
      password: 'Secret123!',
    },
  });

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: 'places@example.com',
      password: 'Secret123!',
    },
  });

  const loginBody = loginResponse.json();

  return {
    Authorization: `Bearer ${loginBody.data.accessToken as string}`,
  };
}

test('places flow supports search, save, list, detail, and duplicate protection', async () => {
  const app = buildApp({
    env: {
      APP_ENV: 'dev',
      CORS_ORIGIN: '*',
      HOST: '0.0.0.0',
      KAKAO_REST_API_KEY: 'test-key',
      LOG_LEVEL: 'silent',
      MAP_PROVIDER: 'kakao',
      PORT: 3000,
    },
    placeSearchClient: {
      search: async () => [
        {
          address: '서울 성동구 연무장길 39-25',
          lat: 37.544958,
          lng: 127.055154,
          name: '성수 미도인',
          provider: 'kakao',
          providerPlaceId: '123456789',
        },
      ],
    },
  });
  const headers = await createAuthenticatedHeader(app);

  const searchResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/places/search?query=성수',
    headers,
  });

  assert.equal(searchResponse.statusCode, 200);
  const searchBody = searchResponse.json();
  assert.ok(searchBody.data.items.length > 0);

  const target = searchBody.data.items[0] as {
    provider: 'naver' | 'kakao' | 'google';
    providerPlaceId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
  };

  const saveResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/places',
    headers,
    payload: target,
  });

  assert.equal(saveResponse.statusCode, 201);
  const saveBody = saveResponse.json();
  assert.ok(saveBody.data.id);

  const duplicateResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/places',
    headers,
    payload: target,
  });

  assert.equal(duplicateResponse.statusCode, 409);
  assert.equal(duplicateResponse.json().error.code, 'PLACE_DUPLICATED');

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/places',
    headers,
  });

  assert.equal(listResponse.statusCode, 200);
  const listBody = listResponse.json();
  assert.equal(listBody.data.items.length, 1);

  const detailResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/places/${saveBody.data.id as string}`,
    headers,
  });

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailResponse.json().data.name, target.name);

  await app.close();
});

test('places endpoints require authorization', async () => {
  const app = buildApp({
    env: {
      APP_ENV: 'dev',
      CORS_ORIGIN: '*',
      HOST: '0.0.0.0',
      KAKAO_REST_API_KEY: 'test-key',
      LOG_LEVEL: 'silent',
      MAP_PROVIDER: 'kakao',
      PORT: 3000,
    },
  });

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/places',
  });

  assert.equal(listResponse.statusCode, 401);

  await app.close();
});
