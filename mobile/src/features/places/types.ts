export type PlaceProvider = 'naver' | 'kakao' | 'google';

export type SearchPlace = {
  provider: PlaceProvider;
  providerPlaceId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type SavedPlace = SearchPlace & {
  id: string;
  savedAt: string;
};
