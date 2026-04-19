import { AppError } from '../../lib/http/errors.js';

import type { PlacesRepository } from './repository.js';
import type { PlaceSearchClient } from './search-client.js';
import type {
  PlaceCollectionRecord,
  PlaceProvider,
  PlaceSearchResult,
  SavedPlaceRecord,
} from './types.js';

export class PlacesService {
  constructor(
    private readonly repository: PlacesRepository,
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
    roadAddress?: string | null;
    categoryName?: string | null;
    categoryGroupName?: string | null;
    phone?: string | null;
    lat?: number;
    lng?: number;
    mapUrl?: string | null;
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
      const metadataPatch = {
        ...(!duplicate.roadAddress && input.roadAddress
          ? { roadAddress: input.roadAddress }
          : {}),
        ...(!duplicate.categoryName && input.categoryName
          ? { categoryName: input.categoryName }
          : {}),
        ...(!duplicate.categoryGroupName && input.categoryGroupName
          ? { categoryGroupName: input.categoryGroupName }
          : {}),
        ...(!duplicate.phone && input.phone ? { phone: input.phone } : {}),
        ...(!duplicate.mapUrl && input.mapUrl ? { mapUrl: input.mapUrl } : {}),
      };

      if (Object.keys(metadataPatch).length > 0) {
        this.repository.update(duplicate.id, metadataPatch);
      }

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

  async listCollections(userId: string): Promise<{
    items: PlaceCollectionRecord[];
    pageInfo: {
      nextCursor: null;
      hasNext: false;
    };
  }> {
    return {
      items: this.repository.listCollectionsByUser(userId),
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

  async createCollection(input: {
    userId: string;
    name: string;
  }): Promise<PlaceCollectionRecord> {
    const normalizedName = normalizeCollectionName(input.name);

    if (!normalizedName) {
      throw new AppError(400, 'VALIDATION_ERROR', 'collection name is required');
    }

    const duplicateCollection = this.repository.findCollectionByName({
      userId: input.userId,
      name: normalizedName,
    });

    if (duplicateCollection) {
      throw new AppError(
        409,
        'COLLECTION_DUPLICATED',
        '이미 같은 이름의 컬렉션이 있어요',
      );
    }

    return this.repository.createCollection({
      userId: input.userId,
      name: normalizedName,
    });
  }

  async addPlaceToCollection(input: {
    userId: string;
    collectionId: string;
    placeId: string;
  }): Promise<PlaceCollectionRecord> {
    await this.getPlace(input.userId, input.placeId);
    const collection = this.repository.findCollectionById(input.collectionId);

    if (!collection || collection.userId !== input.userId) {
      throw new AppError(404, 'NOT_FOUND', 'collection not found');
    }

    const updatedCollection = this.repository.addPlaceToCollection(
      input.collectionId,
      input.placeId,
    );

    if (!updatedCollection) {
      throw new AppError(404, 'NOT_FOUND', 'collection not found');
    }

    return updatedCollection;
  }

  async deleteCollection(userId: string, collectionId: string): Promise<void> {
    const collection = this.repository.findCollectionById(collectionId);

    if (!collection || collection.userId !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'collection not found');
    }

    const deletedCollection = this.repository.deleteCollection(collectionId);

    if (!deletedCollection || deletedCollection.userId !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'collection not found');
    }
  }

  async removePlaceFromCollection(input: {
    userId: string;
    collectionId: string;
    placeId: string;
  }): Promise<PlaceCollectionRecord> {
    await this.getPlace(input.userId, input.placeId);
    const collection = this.repository.findCollectionById(input.collectionId);

    if (!collection || collection.userId !== input.userId) {
      throw new AppError(404, 'NOT_FOUND', 'collection not found');
    }

    const updatedCollection = this.repository.removePlaceFromCollection(
      input.collectionId,
      input.placeId,
    );

    if (!updatedCollection) {
      throw new AppError(404, 'NOT_FOUND', 'collection not found');
    }

    return updatedCollection;
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

function normalizeCollectionName(name: string | null | undefined): string | null {
  if (name === null || name === undefined) {
    return null;
  }

  const trimmedName = name.trim();

  return trimmedName ? trimmedName : null;
}
