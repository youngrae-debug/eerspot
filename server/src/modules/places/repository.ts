import { randomUUID } from 'node:crypto';

import type { PlaceProvider, SavedPlaceRecord } from './types.js';

export class InMemoryPlacesRepository {
  private readonly savedPlaces = new Map<string, SavedPlaceRecord>();
  private readonly savedPlaceIndex = new Map<string, string>();

  constructor(private readonly provider: PlaceProvider) {}

  listByUser(userId: string): SavedPlaceRecord[] {
    return [...this.savedPlaces.values()]
      .filter(place => place.userId === userId)
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  }

  findById(id: string): SavedPlaceRecord | null {
    return this.savedPlaces.get(id) ?? null;
  }

  findDuplicate(input: {
    userId: string;
    provider: PlaceProvider;
    providerPlaceId: string;
  }): SavedPlaceRecord | null {
    const key = this.buildIndexKey(
      input.userId,
      input.provider,
      input.providerPlaceId,
    );
    const existingId = this.savedPlaceIndex.get(key);

    if (!existingId) {
      return null;
    }

    return this.savedPlaces.get(existingId) ?? null;
  }

  create(input: {
    userId: string;
    provider: PlaceProvider;
    providerPlaceId: string;
    name: string;
    address: string;
    lat?: number;
    lng?: number;
  }): SavedPlaceRecord {
    const now = new Date().toISOString();
    const record: SavedPlaceRecord = {
      id: randomUUID(),
      userId: input.userId,
      provider: input.provider,
      providerPlaceId: input.providerPlaceId,
      name: input.name,
      address: input.address,
      lat: input.lat ?? 0,
      lng: input.lng ?? 0,
      savedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.savedPlaces.set(record.id, record);
    this.savedPlaceIndex.set(
      this.buildIndexKey(record.userId, record.provider, record.providerPlaceId),
      record.id,
    );

    return record;
  }

  private buildIndexKey(
    userId: string,
    provider: PlaceProvider,
    providerPlaceId: string,
  ) {
    return `${userId}:${provider}:${providerPlaceId}`;
  }
}
