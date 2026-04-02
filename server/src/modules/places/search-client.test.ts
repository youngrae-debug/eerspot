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
              address_name: '서울 성동구 성수동2가 315-55',
              id: '987654321',
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
