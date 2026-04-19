export type PlaceProvider = 'naver' | 'kakao' | 'google';

export type SearchPlace = {
  provider: PlaceProvider;
  providerPlaceId: string;
  name: string;
  address: string;
  roadAddress?: string | null;
  categoryName?: string | null;
  categoryGroupName?: string | null;
  phone?: string | null;
  lat: number;
  lng: number;
  mapUrl?: string | null;
};

export type SavedPlace = SearchPlace & {
  id: string;
  note: string | null;
  isFavorite: boolean;
  savedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PlaceCollection = {
  id: string;
  name: string;
  placeIds: string[];
  createdAt: string;
  updatedAt: string;
};
