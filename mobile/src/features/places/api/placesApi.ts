import type { RequestOptions } from '../../../shared/api/http';

import type { PlaceCollection, SavedPlace, SearchPlace } from '../types';

type AuthorizedRequest = <T>(
  path: string,
  options?: RequestOptions,
) => Promise<T>;

export async function searchPlaces(
  authorizedRequest: AuthorizedRequest,
  query: string,
): Promise<SearchPlace[]> {
  const data = await authorizedRequest<{ items: SearchPlace[] }>(
    `/places/search?query=${encodeURIComponent(query)}`,
  );

  return data.items;
}

export async function savePlace(
  authorizedRequest: AuthorizedRequest,
  place: SearchPlace,
): Promise<{ id: string }> {
  return authorizedRequest<{ id: string }>('/places', {
    method: 'POST',
    body: place,
  });
}

export async function listPlaces(
  authorizedRequest: AuthorizedRequest,
): Promise<{
  items: SavedPlace[];
  pageInfo: {
    nextCursor: string | null;
    hasNext: boolean;
  };
}> {
  return authorizedRequest('/places');
}

export async function listPlaceCollections(
  authorizedRequest: AuthorizedRequest,
): Promise<{
  items: PlaceCollection[];
  pageInfo: {
    nextCursor: null;
    hasNext: boolean;
  };
}> {
  return authorizedRequest('/places/collections');
}

export async function createPlaceCollection(
  authorizedRequest: AuthorizedRequest,
  input: {
    name: string;
  },
): Promise<PlaceCollection> {
  return authorizedRequest('/places/collections', {
    method: 'POST',
    body: input,
  });
}

export async function deletePlaceCollection(
  authorizedRequest: AuthorizedRequest,
  collectionId: string,
): Promise<void> {
  return authorizedRequest(`/places/collections/${collectionId}`, {
    method: 'DELETE',
  });
}

export async function addPlaceToCollection(
  authorizedRequest: AuthorizedRequest,
  input: {
    collectionId: string;
    placeId: string;
  },
): Promise<PlaceCollection> {
  return authorizedRequest(`/places/collections/${input.collectionId}/places`, {
    method: 'POST',
    body: {
      placeId: input.placeId,
    },
  });
}

export async function removePlaceFromCollection(
  authorizedRequest: AuthorizedRequest,
  input: {
    collectionId: string;
    placeId: string;
  },
): Promise<PlaceCollection> {
  return authorizedRequest(
    `/places/collections/${input.collectionId}/places/${input.placeId}`,
    {
      method: 'DELETE',
    },
  );
}

export async function getPlace(
  authorizedRequest: AuthorizedRequest,
  placeId: string,
): Promise<SavedPlace> {
  return authorizedRequest(`/places/${placeId}`);
}

export async function updatePlace(
  authorizedRequest: AuthorizedRequest,
  placeId: string,
  patch: {
    note?: string | null;
    isFavorite?: boolean;
  },
): Promise<SavedPlace> {
  return authorizedRequest(`/places/${placeId}`, {
    method: 'PATCH',
    body: patch,
  });
}

export async function deletePlace(
  authorizedRequest: AuthorizedRequest,
  placeId: string,
): Promise<void> {
  return authorizedRequest(`/places/${placeId}`, {
    method: 'DELETE',
  });
}
