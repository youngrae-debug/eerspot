import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../lib/http/errors.js';
import { KakaoPlaceSearchClient } from './search-client.js';

test('KakaoPlaceSearchClient maps Kakao keyword results into place search results', async () => {
  const client = new KakaoPlaceSearchClient(
    'test-key',
    async () =>
      ({
        json: async () => ({
          documents: [
            {
              category_group_name: '음식점',
              category_name: '음식점 > 카페 > 테마카페',
              address_name: '서울 성동구 성수동2가 315-55',
              id: '987654321',
              phone: '02-1234-5678',
              place_name: '성수 대림창고',
              place_url: 'https://place.map.kakao.com/987654321',
              road_address_name: '서울 성동구 성수이로 78',
              x: '127.055236',
              y: '37.541569',
            },
          ],
        }),
        ok: true,
        status: 200,
      }) as Response,
  );

  const result = await client.search('성수');

  assert.deepEqual(result, [
    {
      address: '서울 성동구 성수이로 78',
      roadAddress: '서울 성동구 성수이로 78',
      categoryGroupName: '음식점',
      categoryName: '음식점 > 카페 > 테마카페',
      phone: '02-1234-5678',
      lat: 37.541569,
      lng: 127.055236,
      name: '성수 대림창고',
      provider: 'kakao',
      providerPlaceId: '987654321',
      mapUrl: 'https://place.map.kakao.com/987654321',
    },
  ]);
});

test('KakaoPlaceSearchClient surfaces network failures as provider unavailable errors', async () => {
  const client = new KakaoPlaceSearchClient('test-key', async () => {
    throw new TypeError('fetch failed');
  });

  await assert.rejects(
    () => client.search('성수'),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, 'SEARCH_PROVIDER_UNAVAILABLE');
      assert.deepEqual(error.details, {
        cause: 'fetch failed',
      });

      return true;
    },
  );
});

test('KakaoPlaceSearchClient surfaces upstream rate limits with a dedicated error code', async () => {
  const client = new KakaoPlaceSearchClient(
    'test-key',
    async () =>
      ({
        json: async () => ({
          code: -10,
          errorType: 'RequestThrottled',
          msg: 'API limit has been exceeded.',
        }),
        ok: false,
        status: 429,
      }) as Response,
  );

  await assert.rejects(
    () => client.search('성수'),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 429);
      assert.equal(error.code, 'SEARCH_PROVIDER_LIMIT_EXCEEDED');
      assert.deepEqual(error.details, {
        provider: 'kakao',
        status: 429,
        upstreamCode: -10,
        upstreamType: 'RequestThrottled',
        upstreamMessage: 'API limit has been exceeded.',
      });

      return true;
    },
  );
});

test('KakaoPlaceSearchClient surfaces upstream permission failures as misconfigured errors', async () => {
  const client = new KakaoPlaceSearchClient(
    'test-key',
    async () =>
      ({
        json: async () => ({
          code: -401,
          errorType: 'NotAuthorizedError',
          msg: 'App(eerspot) disabled OPEN_MAP_AND_LOCAL service.',
        }),
        ok: false,
        status: 403,
      }) as Response,
  );

  await assert.rejects(
    () => client.search('성수'),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, 'SEARCH_PROVIDER_MISCONFIGURED');
      assert.deepEqual(error.details, {
        provider: 'kakao',
        status: 403,
        upstreamCode: -401,
        upstreamType: 'NotAuthorizedError',
        upstreamMessage: 'App(eerspot) disabled OPEN_MAP_AND_LOCAL service.',
      });

      return true;
    },
  );
});
