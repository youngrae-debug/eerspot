import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../../app.js';
import { AppError } from '../../lib/http/errors.js';

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
  assert.equal(detailResponse.json().data.note, null);
  assert.equal(detailResponse.json().data.isFavorite, false);

  const updateResponse = await app.inject({
    method: 'PATCH',
    url: `/api/v1/places/${saveBody.data.id as string}`,
    headers,
    payload: {
      isFavorite: true,
      note: 'corner seat if possible',
    },
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.json().data.isFavorite, true);
  assert.equal(updateResponse.json().data.note, 'corner seat if possible');

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/places/${saveBody.data.id as string}`,
    headers,
  });

  assert.equal(deleteResponse.statusCode, 204);

  const listAfterDeleteResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/places',
    headers,
  });

  assert.equal(listAfterDeleteResponse.statusCode, 200);
  assert.equal(listAfterDeleteResponse.json().data.items.length, 0);

  await app.close();
});

test('places reject deletion while linked schedules exist', async () => {
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

  const placeId = await saveFirstPlace(app, headers);

  const createScheduleResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/schedules',
    headers,
    payload: {
      title: 'Dinner plan',
      scheduledAt: '2026-03-24T18:00:00.000Z',
      placeId,
    },
  });

  assert.equal(createScheduleResponse.statusCode, 201);

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/places/${placeId}`,
    headers,
  });

  assert.equal(deleteResponse.statusCode, 409);
  assert.equal(deleteResponse.json().error.code, 'PLACE_IN_USE');

  await app.close();
});

test('places can discover related places from a link', async () => {
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
    pageFetchImpl: async () =>
      new Response(
        `
          <html>
            <head>
              <title>성수 카페 투어 가이드</title>
              <meta
                name="description"
                content="서울 성수에서 전시를 보고 카페를 함께 들르기 좋은 하루 코스예요."
              />
            </head>
            <body>
              성수 대림창고와 서울숲 근처 장소를 소개합니다.
            </body>
          </html>
        `,
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        },
      ),
    placeSearchClient: {
      search: async query => {
        if (!query.includes('성수')) {
          return [];
        }

        return [
          {
            address: '서울 성동구 성수이로 78',
            lat: 37.541569,
            lng: 127.055236,
            mapUrl: 'https://place.map.kakao.com/987654321',
            name: '성수 대림창고',
            provider: 'kakao',
            providerPlaceId: '987654321',
          },
        ];
      },
    },
  });
  const headers = await createAuthenticatedHeader(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/places/discover-link',
    headers,
    payload: {
      url: 'https://example.com/seongsu-guide',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.page.title, '성수 카페 투어 가이드');
  assert.equal(response.json().data.page.locationHints[0], '성수');
  assert.equal(response.json().data.items[0].name, '성수 대림창고');
  assert.equal(
    response.json().data.items[0].mapUrl,
    'https://place.map.kakao.com/987654321',
  );

  await app.close();
});

test('places discovery decodes instagram meta text and prefers it over generic body text', async () => {
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
    pageFetchImpl: async () =>
      new Response(
        `
          <html>
            <head>
              <meta
                property="og:title"
                content="&#xc11c;&#xc6b8;&#xb9db;&#xc9d1; on Instagram: &quot;&#x1f4dd;2026 &#xc11c;&#xc6b8; + &#xbd80;&#xc0b0; &#xbe55; &#xad6c;&#xb974;&#xb9dd; 71&#xacf3; &#xcd1d;&#xc815;&#xb9ac;&quot;"
              />
              <meta
                name="description"
                content="1,103 likes, 6 comments - seoul_life___ on March 12, 2026: &quot;&#x1f4dd;2026 &#xc11c;&#xc6b8; + &#xbd80;&#xc0b0; &#xbe55; &#xad6c;&#xb974;&#xb9dd; 71&#xacf3; &#xcd1d;&#xc815;&#xb9ac;&quot;."
              />
            </head>
            <body>
              Instagram Instagram Log In Sign Up Meta About Blog Jobs Help API Privacy Terms
            </body>
          </html>
        `,
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        },
      ),
    placeSearchClient: {
      search: async query => {
        if (!query.includes('빕 구르망') && !query.includes('서울')) {
          return [];
        }

        return [
          {
            address: '서울 중구 충무로7길 20',
            lat: 37.566234,
            lng: 126.991432,
            mapUrl: 'https://place.map.kakao.com/1234',
            name: '을지로 호프집',
            provider: 'kakao',
            providerPlaceId: '1234',
          },
        ];
      },
    },
  });
  const headers = await createAuthenticatedHeader(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/places/discover-link',
    headers,
    payload: {
      url: 'https://www.instagram.com/p/example/',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.page.title, '📝2026 서울 + 부산 빕 구르망 71곳 총정리');
  assert.equal(
    response.json().data.page.description,
    '📝2026 서울 + 부산 빕 구르망 71곳 총정리',
  );
  assert.equal(
    response.json().data.page.contentPreview,
    '📝2026 서울 + 부산 빕 구르망 71곳 총정리',
  );
  assert.equal(response.json().data.page.locationHints[0], '부산');

  await app.close();
});

test('places discovery uses OCR image hints when the link text lacks place names', async () => {
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
    imageOcrClient: {
      extractHints: async () => ['3대삼계장인', '오일제'],
    },
    pageFetchImpl: async () =>
      new Response(
        `
          <html>
            <head>
              <meta
                property="og:title"
                content="서울맛집 on Instagram: &quot;2026 서울 + 부산 빕 구르망 71곳 총정리&quot;"
              />
              <meta
                name="description"
                content="1,103 likes, 6 comments - seoul_life___ on March 12, 2026: &quot;2026 서울 + 부산 빕 구르망 71곳 총정리&quot;."
              />
              <meta
                property="og:image"
                content="https://images.example.com/bib-gourmand.jpg"
              />
            </head>
            <body>
              Instagram Instagram Log In Sign Up Meta About Blog Jobs Help API Privacy Terms
            </body>
          </html>
        `,
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        },
      ),
    placeSearchClient: {
      search: async query => {
        if (!query.includes('3대삼계장인')) {
          return [];
        }

        return [
          {
            address: '서울 종로구 자하문로1길 11',
            lat: 37.577411,
            lng: 126.972289,
            mapUrl: 'https://place.map.kakao.com/9988',
            name: '3대삼계장인',
            provider: 'kakao',
            providerPlaceId: '9988',
          },
        ];
      },
    },
  });
  const headers = await createAuthenticatedHeader(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/places/discover-link',
    headers,
    payload: {
      url: 'https://www.instagram.com/p/example/',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.queryHints[0], '3대삼계장인');
  assert.equal(response.json().data.items[0].name, '3대삼계장인');

  await app.close();
});

test('places discovery returns more than six detected names when OCR finds them', async () => {
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
    imageOcrClient: {
      extractHints: async () => [
        '3대 삼계장인',
        '안덕',
        '게방식당',
        '고사리 익스프레스',
        '오일제',
        '계월',
        '개성만두 궁',
        '곰탕LAB',
      ],
    },
    pageFetchImpl: async () =>
      new Response(
        `
          <html>
            <head>
              <meta
                property="og:title"
                content="서울맛집 on Instagram: &quot;2026 서울 + 부산 빕 구르망 71곳 총정리&quot;"
              />
              <meta
                name="description"
                content="1,103 likes, 6 comments - seoul_life___ on March 12, 2026: &quot;2026 서울 + 부산 빕 구르망 71곳 총정리&quot;."
              />
              <meta
                property="og:image"
                content="https://images.example.com/bib-gourmand.jpg"
              />
            </head>
            <body>
              Instagram Instagram Log In Sign Up Meta About Blog Jobs Help API Privacy Terms
            </body>
          </html>
        `,
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        },
      ),
    placeSearchClient: {
      search: async () => [],
    },
  });
  const headers = await createAuthenticatedHeader(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/places/discover-link',
    headers,
    payload: {
      url: 'https://www.instagram.com/p/example/',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.queryHints.length, 8);
  assert.equal(response.json().data.queryHints[6], '개성만두 궁');
  assert.equal(response.json().data.queryHints[7], '곰탕LAB');

  await app.close();
});

test('places discovery prefers explicit instagram place markers in reel captions', async () => {
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
    imageOcrClient: {
      extractHints: async () => ['인스타그램', '요즘 핫한', '판매처 10'],
    },
    pageFetchImpl: async () =>
      new Response(
        `
          <html>
            <head>
              <meta
                property="og:title"
                content="서울 카페 on Instagram: &quot;디저트 + 커피 조합이 좋은 곳&quot;"
              />
              <meta
                name="description"
                content="1,103 likes, 6 comments - cafe_note on March 12, 2026: &quot;디저트 + 커피 좋아하는 내 친구 소환!! [SummerBird Open Event] 📌썸머버드 카페 📍서울 서초구 효령로55길 19 1층&quot;."
              />
              <meta
                property="og:image"
                content="https://images.example.com/summerbird-reel.jpg"
              />
            </head>
            <body>
              Instagram Instagram Log In Sign Up Meta About Blog Jobs Help API Privacy Terms
            </body>
          </html>
        `,
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        },
      ),
    placeSearchClient: {
      search: async query => {
        if (!query.includes('썸머버드')) {
          return [];
        }

        return [
          {
            address: '서울 서초구 효령로55길 19 1층',
            lat: 37.48612,
            lng: 127.01542,
            mapUrl: 'https://place.map.kakao.com/445566',
            name: '썸머버드',
            provider: 'kakao',
            providerPlaceId: '445566',
          },
        ];
      },
    },
  });
  const headers = await createAuthenticatedHeader(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/places/discover-link',
    headers,
    payload: {
      url: 'https://www.instagram.com/reel/example/',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.queryHints[0], '썸머버드');
  assert.equal(response.json().data.items[0].name, '썸머버드');

  await app.close();
});

test('places discovery prefers instagram place markers over narrative fragments', async () => {
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
      search: async () => [],
    },
    pageFetchImpl: async () =>
      new Response(
        `
          <html>
            <head>
              <meta
                property="og:title"
                content="전주맛집 on Instagram: &quot;🍴전주 남부시장 필먹코스 푼다.🍴 @@자기야 시장 맛집 도장깨기 가자(*ˊᵕˋ*)੭❤ 전주 토박이 Pick!📝 📍메르미진미집 : 시원한 메밀소바 제대로 말아주는 곳 📍홍화연 : 자극적인 물짜장과 다르게 재료가 다 느껴지는 맛 📍마라크림새우 : 바삭함과 탱글함이 입에서 탱고추는 맛&quot;"
              />
              <meta
                name="description"
                content="556 likes, 12 comments - all.about.jeonju on March 18, 2026: &quot;🍴전주 남부시장 필먹코스 푼다.🍴 @@자기야 시장 맛집 도장깨기 가자(*ˊᵕˋ*)੭❤ 전주 토박이 Pick!📝 📍메르미진미집 : 시원한 메밀소바 제대로 말아주는 곳 📍홍화연 : 자극적인 물짜장과 다르게 재료가 다 느껴지는 맛 📍마라크림새우 : 바삭함과 탱글함이 입에서 탱고추는 맛&quot;."
              />
            </head>
            <body>
              Instagram Instagram Log In Sign Up Meta About Blog Jobs Help API Privacy Terms
            </body>
          </html>
        `,
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        },
      ),
  });
  const headers = await createAuthenticatedHeader(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/places/discover-link',
    headers,
    payload: {
      url: 'https://www.instagram.com/p/DWBK956jR0X/?img_index=4',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.page.locationHints[0], '전주');
  assert.deepEqual(response.json().data.queryHints, [
    '메르미진미집',
    '홍화연',
    '마라크림새우',
  ]);
  assert.equal(response.json().data.queryHints.includes('도장깨기'), false);
  assert.equal(response.json().data.queryHints.includes('제대로'), false);

  await app.close();
});

test('places discovery extracts instagram narrative reel captions ending with 입니다', async () => {
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
    imageOcrClient: {
      extractHints: async () => ['처음', '배우는 진', '삼겹살 하나에', '천을 태우는 집'],
    },
    pageFetchImpl: async () =>
      new Response(
        `
          <html>
            <head>
              <meta
                property="og:title"
                content="강호동님도 반한 고깃집 on Instagram: &quot;삼천번을 썰어버리는 삼겹살 맛집 리정원 입니다&quot;"
              />
              <meta
                name="description"
                content="4,103 likes, 106 comments - grill_note on March 18, 2026: &quot;삼천번을 썰어버리는 삼겹살 맛집 리정원 입니다. 처음 배우는 진짜 칼집 기술.&quot;."
              />
              <meta
                property="og:image"
                content="https://images.example.com/rijeongwon-reel.jpg"
              />
            </head>
            <body>
              Instagram Instagram Log In Sign Up Meta About Blog Jobs Help API Privacy Terms
            </body>
          </html>
        `,
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        },
      ),
    placeSearchClient: {
      search: async query => {
        if (!query.includes('리정원')) {
          return [];
        }

        return [
          {
            address: '서울 성동구 연무장길 12',
            lat: 37.54412,
            lng: 127.05511,
            mapUrl: 'https://place.map.kakao.com/778899',
            name: '리정원',
            provider: 'kakao',
            providerPlaceId: '778899',
          },
        ];
      },
    },
  });
  const headers = await createAuthenticatedHeader(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/places/discover-link',
    headers,
    payload: {
      url: 'https://www.instagram.com/reel/example-rijeongwon/',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.json().data.queryHints.includes('리정원'));
  assert.equal(response.json().data.items[0].name, '리정원');

  await app.close();
});

test('places discovery extracts instagram narrative reel captions ending with 다녀왔습니다', async () => {
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
    imageOcrClient: {
      extractHints: async () => ['대구 3', '내 연잎 숙', '성 막창', '이영자님 극찬'],
    },
    pageFetchImpl: async () =>
      new Response(
        `
          <html>
            <head>
              <meta
                property="og:title"
                content="대구 먹방 on Instagram: &quot;대구 3대 연잎 숙성 막창 연막창 다녀왔습니다&quot;"
              />
              <meta
                name="description"
                content="2,103 likes, 36 comments - daegu_table on March 19, 2026: &quot;이영자님도 극찬한 대구 3대 연잎 숙성 막창 연막창 다녀왔습니다.&quot;."
              />
              <meta
                property="og:image"
                content="https://images.example.com/yeonmakchang-reel.jpg"
              />
            </head>
            <body>
              Instagram Instagram Log In Sign Up Meta About Blog Jobs Help API Privacy Terms
            </body>
          </html>
        `,
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        },
      ),
    placeSearchClient: {
      search: async query => {
        if (!query.includes('연막창')) {
          return [];
        }

        return [
          {
            address: '대구 중구 중앙대로 23',
            lat: 35.8681,
            lng: 128.5947,
            mapUrl: 'https://place.map.kakao.com/991122',
            name: '연막창',
            provider: 'kakao',
            providerPlaceId: '991122',
          },
        ];
      },
    },
  });
  const headers = await createAuthenticatedHeader(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/places/discover-link',
    headers,
    payload: {
      url: 'https://www.instagram.com/reel/example-yeonmakchang/',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.json().data.queryHints.includes('연막창'));
  assert.equal(response.json().data.items[0].name, '연막창');

  await app.close();
});

test('places discovery reads instagram carousel slides beyond the cover image', async () => {
  const slideImageUrl =
    'https://scontent-nrt6-1.cdninstagram.com/v/t51.82787-15/slide-2.jpg';
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
    imageOcrClient: {
      extractHints: async imageUrl => {
        if (imageUrl !== slideImageUrl) {
          return [];
        }

        return ['3대 삼계장인', '오일제'];
      },
    },
    pageFetchImpl: async input => {
      const url = input instanceof Request ? input.url : String(input);

      if (url.endsWith('/embed/captioned/')) {
        return new Response(
          `
            <html>
              <body>
                \\"edge_sidecar_to_children\\":{\\"edges\\":[
                  {\\"node\\":{\\"display_url\\":\\"https:\\\\/\\\\/scontent-nrt6-1.cdninstagram.com\\\\/v\\\\/t51.82787-15\\\\/cover.jpg\\"}},
                  {\\"node\\":{\\"display_url\\":\\"https:\\\\/\\\\/scontent-nrt6-1.cdninstagram.com\\\\/v\\\\/t51.82787-15\\\\/slide-2.jpg\\"}}
                ]}
              </body>
            </html>
          `,
          {
            headers: {
              'content-type': 'text/html; charset=utf-8',
            },
            status: 200,
          },
        );
      }

      return new Response(
        `
          <html>
            <head>
              <meta
                property="og:title"
                content="서울맛집 on Instagram: &quot;2026 서울 + 부산 빕 구르망 71곳 총정리&quot;"
              />
              <meta
                name="description"
                content="1,103 likes, 6 comments - seoul_life___ on March 12, 2026: &quot;2026 서울 + 부산 빕 구르망 71곳 총정리&quot;."
              />
              <meta
                property="og:image"
                content="https://scontent-nrt6-1.cdninstagram.com/v/t51.82787-15/cover.jpg"
              />
            </head>
            <body>
              Instagram Instagram Log In Sign Up Meta About Blog Jobs Help API Privacy Terms
            </body>
          </html>
        `,
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        },
      );
    },
    placeSearchClient: {
      search: async query => {
        if (!query.includes('3대 삼계장인')) {
          return [];
        }

        return [
          {
            address: '서울 종로구 자하문로1길 11',
            lat: 37.577411,
            lng: 126.972289,
            mapUrl: 'https://place.map.kakao.com/9988',
            name: '3대 삼계장인',
            provider: 'kakao',
            providerPlaceId: '9988',
          },
        ];
      },
    },
  });
  const headers = await createAuthenticatedHeader(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/places/discover-link',
    headers,
    payload: {
      url: 'https://www.instagram.com/p/example/',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.queryHints[0], '3대 삼계장인');
  assert.equal(response.json().data.items[0].name, '3대 삼계장인');

  await app.close();
});

test('places discovery reads multiple content images from a generic page', async () => {
  const thirdImageUrl = 'https://cdn.example.com/images/list-3.jpg';
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
    imageOcrClient: {
      extractHints: async imageUrl => {
        if (imageUrl !== thirdImageUrl) {
          return [];
        }

        return ['개성만두 궁'];
      },
    },
    pageFetchImpl: async () =>
      new Response(
        `
          <html>
            <head>
              <title>을지로 만두 리스트</title>
              <meta
                property="og:image"
                content="https://example.com/images/list-1.jpg"
              />
              <meta
                property="og:image"
                content="https://example.com/images/list-2.jpg"
              />
            </head>
            <body>
              <img src="/assets/logo.svg" />
              <img src="https://cdn.example.com/images/list-3.jpg" />
            </body>
          </html>
        `,
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        },
      ),
    placeSearchClient: {
      search: async query => {
        if (!query.includes('개성만두 궁')) {
          return [];
        }

        return [
          {
            address: '서울 종로구 행촌길 12',
            lat: 37.57321,
            lng: 126.96811,
            mapUrl: 'https://place.map.kakao.com/5566',
            name: '개성만두 궁',
            provider: 'kakao',
            providerPlaceId: '5566',
          },
        ];
      },
    },
  });
  const headers = await createAuthenticatedHeader(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/places/discover-link',
    headers,
    payload: {
      url: 'https://example.com/euljiro-mandu-list',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.queryHints[0], '개성만두 궁');
  assert.equal(response.json().data.items[0].name, '개성만두 궁');

  await app.close();
});

test('places discovery checks up to 10 instagram carousel images', async () => {
  const ocrCalls: string[] = [];
  const sidecarSlides = Array.from({ length: 12 }, (_value, index) => {
    const imageNumber = index + 1;

    return `{\\"node\\":{\\"display_url\\":\\"https:\\\\/\\\\/scontent-nrt6-1.cdninstagram.com\\\\/v\\\\/t51.82787-15\\\\/slide-${imageNumber}.jpg\\"}}`;
  }).join(',');
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
    imageOcrClient: {
      extractHints: async imageUrl => {
        ocrCalls.push(imageUrl);
        return [];
      },
    },
    pageFetchImpl: async input => {
      const url = input instanceof Request ? input.url : String(input);

      if (url.endsWith('/embed/captioned/')) {
        return new Response(
          `
            <html>
              <body>
                \\"edge_sidecar_to_children\\":{\\"edges\\":[${sidecarSlides}]}
              </body>
            </html>
          `,
          {
            headers: {
              'content-type': 'text/html; charset=utf-8',
            },
            status: 200,
          },
        );
      }

      return new Response(
        `
          <html>
            <head>
              <meta
                property="og:title"
                content="서울맛집 on Instagram: &quot;서울 만두 리스트&quot;"
              />
              <meta
                name="description"
                content="1,103 likes, 6 comments - seoul_life___ on March 12, 2026: &quot;서울 만두 리스트&quot;."
              />
              <meta
                property="og:image"
                content="https://scontent-nrt6-1.cdninstagram.com/v/t51.82787-15/slide-1.jpg"
              />
            </head>
            <body>
              Instagram Instagram Log In Sign Up Meta About Blog Jobs Help API Privacy Terms
            </body>
          </html>
        `,
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        },
      );
    },
    placeSearchClient: {
      search: async () => [],
    },
  });
  const headers = await createAuthenticatedHeader(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/places/discover-link',
    headers,
    payload: {
      url: 'https://www.instagram.com/p/example/',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(ocrCalls.length, 10);
  assert.equal(
    ocrCalls[0],
    'https://scontent-nrt6-1.cdninstagram.com/v/t51.82787-15/slide-2.jpg',
  );
  assert.equal(
    ocrCalls.at(-1),
    'https://scontent-nrt6-1.cdninstagram.com/v/t51.82787-15/slide-1.jpg',
  );

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

test('places search returns provider unavailable when upstream search fails', async () => {
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
      search: async () => {
        throw new AppError(
          503,
          'SEARCH_PROVIDER_UNAVAILABLE',
          'Kakao place search is temporarily unavailable',
        );
      },
    },
  });
  const headers = await createAuthenticatedHeader(app);

  const searchResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/places/search?query=성수',
    headers,
  });

  assert.equal(searchResponse.statusCode, 503);
  assert.equal(searchResponse.json().error.code, 'SEARCH_PROVIDER_UNAVAILABLE');

  await app.close();
});

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
