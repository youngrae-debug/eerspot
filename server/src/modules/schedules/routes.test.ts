import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { buildApp } from '../../app.js';

function createTestApp() {
  return buildApp({
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
}

async function createAuthenticatedHeader(
  app: ReturnType<typeof buildApp>,
  input: {
    email: string;
    password: string;
  },
) {
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: input,
  });

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: input,
  });

  return {
    Authorization: `Bearer ${loginResponse.json().data.accessToken as string}`,
  };
}

async function saveFirstPlace(
  app: ReturnType<typeof buildApp>,
  headers: Record<string, string>,
) {
  const searchResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/places/search?query=성수',
    headers,
  });

  const target = searchResponse.json().data.items[0] as {
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

  return saveResponse.json().data.id as string;
}

test('schedules flow supports create, list, detail, update, and soft delete', async () => {
  const app = createTestApp();
  const headers = await createAuthenticatedHeader(app, {
    email: 'schedules@example.com',
    password: 'Secret123!',
  });
  const placeId = await saveFirstPlace(app, headers);

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/schedules',
    headers,
    payload: {
      title: '저녁 약속',
      scheduledAt: '2026-03-21T09:00:00Z',
      memo: '늦지 않기',
      placeId,
    },
  });

  assert.equal(createResponse.statusCode, 201);
  const scheduleId = createResponse.json().data.id as string;

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/schedules?from=2026-03-01&to=2026-03-31',
    headers,
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().data.items.length, 1);
  assert.equal(listResponse.json().data.items[0].placeId, placeId);

  const detailResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/schedules/${scheduleId}`,
    headers,
  });

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailResponse.json().data.memo, '늦지 않기');

  const updateResponse = await app.inject({
    method: 'PATCH',
    url: `/api/v1/schedules/${scheduleId}`,
    headers,
    payload: {
      title: '저녁 약속(수정)',
      visitStatus: 'visited',
      placeId: null,
      memo: '도착 완료',
    },
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.json().data.updated, true);

  const updatedDetailResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/schedules/${scheduleId}`,
    headers,
  });

  assert.equal(updatedDetailResponse.json().data.title, '저녁 약속(수정)');
  assert.equal(updatedDetailResponse.json().data.visitStatus, 'visited');
  assert.equal(updatedDetailResponse.json().data.placeId, null);

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/schedules/${scheduleId}`,
    headers,
  });

  assert.equal(deleteResponse.statusCode, 204);

  const emptyListResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/schedules?from=2026-03-01&to=2026-03-31',
    headers,
  });

  assert.equal(emptyListResponse.statusCode, 200);
  assert.equal(emptyListResponse.json().data.items.length, 0);

  const deletedDetailResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/schedules/${scheduleId}`,
    headers,
  });

  assert.equal(deletedDetailResponse.statusCode, 404);

  await app.close();
});

test('schedules reject linking a place owned by another user', async () => {
  const app = createTestApp();
  const ownerHeaders = await createAuthenticatedHeader(app, {
    email: 'owner@example.com',
    password: 'Secret123!',
  });
  const viewerHeaders = await createAuthenticatedHeader(app, {
    email: 'viewer@example.com',
    password: 'Secret123!',
  });
  const ownerPlaceId = await saveFirstPlace(app, ownerHeaders);

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/schedules',
    headers: viewerHeaders,
    payload: {
      title: '권한 체크',
      scheduledAt: '2026-03-21T09:00:00Z',
      placeId: ownerPlaceId,
    },
  });

  assert.equal(createResponse.statusCode, 404);
  assert.equal(createResponse.json().error.code, 'NOT_FOUND');

  const unknownPlaceResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/schedules',
    headers: viewerHeaders,
    payload: {
      title: '없는 장소',
      scheduledAt: '2026-03-21T10:00:00Z',
      placeId: randomUUID(),
    },
  });

  assert.equal(unknownPlaceResponse.statusCode, 404);

  await app.close();
});

test('schedules endpoints require authorization', async () => {
  const app = createTestApp();

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/schedules?from=2026-03-01&to=2026-03-31',
  });

  assert.equal(listResponse.statusCode, 401);

  await app.close();
});
