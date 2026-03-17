export type PlaceProvider = 'naver' | 'kakao' | 'google';

export type PlaceSearchResult = {
  provider: PlaceProvider;
  providerPlaceId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type SavedPlaceRecord = PlaceSearchResult & {
  id: string;
  userId: string;
  savedAt: string;
  createdAt: string;
  updatedAt: string;
};
