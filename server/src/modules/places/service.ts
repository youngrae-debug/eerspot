import { AppError } from '../../lib/http/errors.js';

import { InMemoryPlacesRepository } from './repository.js';
import type { PlaceSearchClient } from './search-client.js';
import type { PlaceProvider, PlaceSearchResult, SavedPlaceRecord } from './types.js';

export class PlacesService {
  constructor(
    private readonly repository: InMemoryPlacesRepository,
    private readonly activeProvider: PlaceProvider,
    private readonly searchClient: PlaceSearchClient,
  ) {}

  async searchPlaces(query: string): Promise<PlaceSearchResult[]> {
    return this.searchClient.search(query);
  }

  async savePlace(input: {
    userId: string;
    provider: PlaceProvider;
    providerPlaceId: string;
    name: string;
    address: string;
    lat?: number;
    lng?: number;
  }): Promise<{ id: string }> {
    if (input.provider !== this.activeProvider) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'provider does not match active MAP_PROVIDER',
      );
    }

    const duplicate = this.repository.findDuplicate({
      userId: input.userId,
      provider: input.provider,
      providerPlaceId: input.providerPlaceId,
    });

    if (duplicate) {
      throw new AppError(409, 'PLACE_DUPLICATED', '이미 저장된 장소입니다', {
        existingPlaceId: duplicate.id,
      });
    }

    const place = this.repository.create(input);

    return {
      id: place.id,
    };
  }

  async listPlaces(userId: string): Promise<{
    items: SavedPlaceRecord[];
    pageInfo: {
      nextCursor: null;
      hasNext: false;
    };
  }> {
    return {
      items: this.repository.listByUser(userId),
      pageInfo: {
        nextCursor: null,
        hasNext: false,
      },
    };
  }

  async getPlace(userId: string, placeId: string): Promise<SavedPlaceRecord> {
    const place = this.repository.findById(placeId);

    if (!place || place.userId !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'place not found');
    }

    return place;
  }

  async updatePlace(input: {
    userId: string;
    placeId: string;
    note?: string | null;
    isFavorite?: boolean;
  }): Promise<SavedPlaceRecord> {
    await this.getPlace(input.userId, input.placeId);

    const nextPlace = this.repository.update(input.placeId, {
      ...(input.note !== undefined ? { note: normalizeNote(input.note) } : {}),
      ...(input.isFavorite !== undefined
        ? { isFavorite: input.isFavorite }
        : {}),
    });

    if (!nextPlace || nextPlace.userId !== input.userId) {
      throw new AppError(404, 'NOT_FOUND', 'place not found');
    }

    return nextPlace;
  }

  async deletePlace(userId: string, placeId: string): Promise<void> {
    await this.getPlace(userId, placeId);

    const deletedPlace = this.repository.delete(placeId);

    if (!deletedPlace || deletedPlace.userId !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'place not found');
    }
  }
}

function normalizeNote(note: string | null | undefined): string | null {
  if (note === null || note === undefined) {
    return null;
  }

  const trimmedNote = note.trim();

  return trimmedNote ? trimmedNote : null;
}
