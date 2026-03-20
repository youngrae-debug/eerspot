import { AppError } from '../../lib/http/errors.js';

import type { PlaceProvider, PlaceSearchResult } from './types.js';

export type PlaceSearchClient = {
  search: (query: string) => Promise<PlaceSearchResult[]>;
};

const catalogSeed: Array<{
  slug: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}> = [
  {
    slug: 'seongsu-midoin',
    name: '성수 미도인',
    address: '서울 성동구 연무장길 39-25',
    lat: 37.544958,
    lng: 127.055154,
  },
  {
    slug: 'seongsu-daelim',
    name: '성수 대림창고',
    address: '서울 성동구 성수이로 78',
    lat: 37.541569,
    lng: 127.055236,
  },
  {
    slug: 'eulji-hof',
    name: '을지로 호프집',
    address: '서울 중구 충무로7길 20',
    lat: 37.566234,
    lng: 126.991432,
  },
  {
    slug: 'yeonnam-bookshop',
    name: '연남 작은서점',
    address: '서울 마포구 동교로38길 27',
    lat: 37.562148,
    lng: 126.925857,
  },
  {
    slug: 'hannam-brunch',
    name: '한남 브런치 하우스',
    address: '서울 용산구 이태원로54길 58',
    lat: 37.534865,
    lng: 127.000942,
  },
];

type KakaoKeywordSearchResponse = {
  documents: Array<{
    id: string;
    place_name: string;
    address_name: string;
    road_address_name: string;
    x: string;
    y: string;
  }>;
};

export class StaticCatalogPlaceSearchClient implements PlaceSearchClient {
  constructor(private readonly provider: PlaceProvider) {}

  async search(query: string): Promise<PlaceSearchResult[]> {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return [];
    }

    return catalogSeed
      .filter(seed =>
        `${seed.name} ${seed.address}`.toLowerCase().includes(normalizedQuery),
      )
      .map(seed => ({
        provider: this.provider,
        providerPlaceId: `${this.provider}_${seed.slug}`,
        name: seed.name,
        address: seed.address,
        lat: seed.lat,
        lng: seed.lng,
      }));
  }
}

export class KakaoPlaceSearchClient implements PlaceSearchClient {
  constructor(
    private readonly restApiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(query: string): Promise<PlaceSearchResult[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [];
    }

    if (!this.restApiKey) {
      throw new AppError(
        503,
        'SEARCH_PROVIDER_UNAVAILABLE',
        'KAKAO_REST_API_KEY is required for Kakao place search',
      );
    }

    let response: Response;

    try {
      response = await this.fetchImpl(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(
          normalizedQuery,
        )}&size=15`,
        {
          headers: {
            Authorization: `KakaoAK ${this.restApiKey}`,
          },
        },
      );
    } catch (error) {
      throw new AppError(
        503,
        'SEARCH_PROVIDER_UNAVAILABLE',
        'Kakao place search is temporarily unavailable',
        {
          cause:
            error instanceof Error && error.message
              ? error.message
              : 'unknown fetch error',
        },
      );
    }

    if (!response.ok) {
      throw new AppError(
        502,
        'SEARCH_PROVIDER_ERROR',
        'Kakao place search request failed',
        {
          status: response.status,
        },
      );
    }

    const payload = (await response.json()) as KakaoKeywordSearchResponse;

    return payload.documents.map(document => ({
      provider: 'kakao',
      providerPlaceId: document.id,
      name: document.place_name,
      address: document.road_address_name || document.address_name,
      lat: Number(document.y),
      lng: Number(document.x),
    }));
  }
}
