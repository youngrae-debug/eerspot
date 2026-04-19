import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import type {
  PlaceCollectionRecord,
  PlaceProvider,
  SavedPlaceRecord,
} from './types.js';

export type PlacesRepository = {
  listByUser: (userId: string) => SavedPlaceRecord[];
  listCollectionsByUser: (userId: string) => PlaceCollectionRecord[];
  findCollectionById: (id: string) => PlaceCollectionRecord | null;
  findCollectionByName: (input: {
    userId: string;
    name: string;
  }) => PlaceCollectionRecord | null;
  findById: (id: string) => SavedPlaceRecord | null;
  findDuplicate: (input: {
    userId: string;
    provider: PlaceProvider;
    providerPlaceId: string;
  }) => SavedPlaceRecord | null;
  create: (input: {
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
  }) => SavedPlaceRecord;
  createCollection: (input: {
    userId: string;
    name: string;
  }) => PlaceCollectionRecord;
  deleteCollection: (id: string) => PlaceCollectionRecord | null;
  addPlaceToCollection: (
    collectionId: string,
    placeId: string,
  ) => PlaceCollectionRecord | null;
  removePlaceFromCollection: (
    collectionId: string,
    placeId: string,
  ) => PlaceCollectionRecord | null;
  update: (
    id: string,
    patch: {
      note?: string | null;
      isFavorite?: boolean;
      roadAddress?: string | null;
      categoryName?: string | null;
      categoryGroupName?: string | null;
      phone?: string | null;
      mapUrl?: string | null;
    },
  ) => SavedPlaceRecord | null;
  delete: (id: string) => SavedPlaceRecord | null;
};

export class InMemoryPlacesRepository implements PlacesRepository {
  private readonly savedPlaces = new Map<string, SavedPlaceRecord>();
  private readonly savedPlaceIndex = new Map<string, string>();
  private readonly collections = new Map<string, PlaceCollectionRecord>();
  private readonly collectionNameIndex = new Map<string, string>();

  constructor(private readonly provider: PlaceProvider) {}

  listByUser(userId: string): SavedPlaceRecord[] {
    return [...this.savedPlaces.values()]
      .filter(place => place.userId === userId)
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  }

  listCollectionsByUser(userId: string): PlaceCollectionRecord[] {
    return [...this.collections.values()]
      .filter(collection => collection.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  findCollectionById(id: string): PlaceCollectionRecord | null {
    return this.collections.get(id) ?? null;
  }

  findCollectionByName(input: {
    userId: string;
    name: string;
  }): PlaceCollectionRecord | null {
    const collectionId = this.collectionNameIndex.get(
      this.buildCollectionNameKey(input.userId, input.name),
    );

    if (!collectionId) {
      return null;
    }

    return this.collections.get(collectionId) ?? null;
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
    roadAddress?: string | null;
    categoryName?: string | null;
    categoryGroupName?: string | null;
    phone?: string | null;
    lat?: number;
    lng?: number;
    mapUrl?: string | null;
  }): SavedPlaceRecord {
    const now = new Date().toISOString();
    const record: SavedPlaceRecord = {
      id: randomUUID(),
      userId: input.userId,
      provider: input.provider,
      providerPlaceId: input.providerPlaceId,
      name: input.name,
      address: input.address,
      roadAddress: input.roadAddress ?? null,
      categoryName: input.categoryName ?? null,
      categoryGroupName: input.categoryGroupName ?? null,
      phone: input.phone ?? null,
      lat: input.lat ?? 0,
      lng: input.lng ?? 0,
      mapUrl: input.mapUrl ?? null,
      note: null,
      isFavorite: false,
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

  createCollection(input: {
    userId: string;
    name: string;
  }): PlaceCollectionRecord {
    const now = new Date().toISOString();
    const record: PlaceCollectionRecord = {
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      placeIds: [],
      createdAt: now,
      updatedAt: now,
    };

    this.collections.set(record.id, record);
    this.collectionNameIndex.set(
      this.buildCollectionNameKey(record.userId, record.name),
      record.id,
    );

    return record;
  }

  deleteCollection(id: string): PlaceCollectionRecord | null {
    const existingCollection = this.collections.get(id);

    if (!existingCollection) {
      return null;
    }

    this.collections.delete(id);
    this.collectionNameIndex.delete(
      this.buildCollectionNameKey(
        existingCollection.userId,
        existingCollection.name,
      ),
    );

    return existingCollection;
  }

  addPlaceToCollection(
    collectionId: string,
    placeId: string,
  ): PlaceCollectionRecord | null {
    const existingCollection = this.collections.get(collectionId);

    if (!existingCollection) {
      return null;
    }

    if (existingCollection.placeIds.includes(placeId)) {
      return existingCollection;
    }

    const nextCollection: PlaceCollectionRecord = {
      ...existingCollection,
      placeIds: [...existingCollection.placeIds, placeId],
      updatedAt: new Date().toISOString(),
    };

    this.collections.set(collectionId, nextCollection);

    return nextCollection;
  }

  removePlaceFromCollection(
    collectionId: string,
    placeId: string,
  ): PlaceCollectionRecord | null {
    const existingCollection = this.collections.get(collectionId);

    if (!existingCollection) {
      return null;
    }

    const nextCollection: PlaceCollectionRecord = {
      ...existingCollection,
      placeIds: existingCollection.placeIds.filter(id => id !== placeId),
      updatedAt: new Date().toISOString(),
    };

    this.collections.set(collectionId, nextCollection);

    return nextCollection;
  }

  update(
    id: string,
    patch: {
      note?: string | null;
      isFavorite?: boolean;
      roadAddress?: string | null;
      categoryName?: string | null;
      categoryGroupName?: string | null;
      phone?: string | null;
      mapUrl?: string | null;
    },
  ): SavedPlaceRecord | null {
    const existingPlace = this.savedPlaces.get(id);

    if (!existingPlace) {
      return null;
    }

    const nextPlace: SavedPlaceRecord = {
      ...existingPlace,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    this.savedPlaces.set(id, nextPlace);

    return nextPlace;
  }

  delete(id: string): SavedPlaceRecord | null {
    const existingPlace = this.savedPlaces.get(id);

    if (!existingPlace) {
      return null;
    }

    this.savedPlaces.delete(id);
    this.savedPlaceIndex.delete(
      this.buildIndexKey(
        existingPlace.userId,
        existingPlace.provider,
        existingPlace.providerPlaceId,
      ),
    );

    [...this.collections.values()]
      .filter(collection => collection.placeIds.includes(id))
      .forEach(collection => {
        this.collections.set(collection.id, {
          ...collection,
          placeIds: collection.placeIds.filter(placeId => placeId !== id),
          updatedAt: new Date().toISOString(),
        });
      });

    return existingPlace;
  }

  private buildIndexKey(
    userId: string,
    provider: PlaceProvider,
    providerPlaceId: string,
  ) {
    return `${userId}:${provider}:${providerPlaceId}`;
  }

  private buildCollectionNameKey(userId: string, name: string) {
    return `${userId}:${name.trim().toLocaleLowerCase()}`;
  }
}

export class SQLitePlacesRepository implements PlacesRepository {
  constructor(private readonly database: DatabaseSync) {}

  listByUser(userId: string): SavedPlaceRecord[] {
    return this.database
      .prepare(
        `
          SELECT
            id,
            user_id AS userId,
            provider,
            provider_place_id AS providerPlaceId,
            name,
            address,
            road_address AS roadAddress,
            category_name AS categoryName,
            category_group_name AS categoryGroupName,
            phone,
            lat,
            lng,
            map_url AS mapUrl,
            note,
            is_favorite AS isFavorite,
            saved_at AS savedAt,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM places
          WHERE user_id = ?
          ORDER BY saved_at DESC
        `,
      )
      .all(userId)
      .map(mapSavedPlaceRow);
  }

  listCollectionsByUser(userId: string): PlaceCollectionRecord[] {
    const collectionRows = this.database
      .prepare(
        `
          SELECT
            id,
            user_id AS userId,
            name,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM place_collections
          WHERE user_id = ?
          ORDER BY updated_at DESC
        `,
      )
      .all(userId);

    return mapCollectionRows(
      collectionRows,
      this.listCollectionMemberships(
        collectionRows.map(row => String(row.id)),
      ),
    );
  }

  findCollectionById(id: string): PlaceCollectionRecord | null {
    const row = this.database
      .prepare(
        `
          SELECT
            id,
            user_id AS userId,
            name,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM place_collections
          WHERE id = ?
        `,
      )
      .get(id);

    if (!row) {
      return null;
    }

    return mapCollectionRows([row], this.listCollectionMemberships([id]))[0] ?? null;
  }

  findCollectionByName(input: {
    userId: string;
    name: string;
  }): PlaceCollectionRecord | null {
    const row = this.database
      .prepare(
        `
          SELECT
            id,
            user_id AS userId,
            name,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM place_collections
          WHERE user_id = ? AND name = ?
        `,
      )
      .get(input.userId, input.name);

    if (!row) {
      return null;
    }

    return (
      mapCollectionRows(
        [row],
        this.listCollectionMemberships([String(row.id)]),
      )[0] ?? null
    );
  }

  findById(id: string): SavedPlaceRecord | null {
    const row = this.database
      .prepare(
        `
          SELECT
            id,
            user_id AS userId,
            provider,
            provider_place_id AS providerPlaceId,
            name,
            address,
            road_address AS roadAddress,
            category_name AS categoryName,
            category_group_name AS categoryGroupName,
            phone,
            lat,
            lng,
            map_url AS mapUrl,
            note,
            is_favorite AS isFavorite,
            saved_at AS savedAt,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM places
          WHERE id = ?
        `,
      )
      .get(id);

    return row ? mapSavedPlaceRow(row) : null;
  }

  findDuplicate(input: {
    userId: string;
    provider: PlaceProvider;
    providerPlaceId: string;
  }): SavedPlaceRecord | null {
    const row = this.database
      .prepare(
        `
          SELECT
            id,
            user_id AS userId,
            provider,
            provider_place_id AS providerPlaceId,
            name,
            address,
            road_address AS roadAddress,
            category_name AS categoryName,
            category_group_name AS categoryGroupName,
            phone,
            lat,
            lng,
            map_url AS mapUrl,
            note,
            is_favorite AS isFavorite,
            saved_at AS savedAt,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM places
          WHERE user_id = ? AND provider = ? AND provider_place_id = ?
        `,
      )
      .get(input.userId, input.provider, input.providerPlaceId);

    return row ? mapSavedPlaceRow(row) : null;
  }

  create(input: {
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
  }): SavedPlaceRecord {
    const now = new Date().toISOString();
    const record: SavedPlaceRecord = {
      id: randomUUID(),
      userId: input.userId,
      provider: input.provider,
      providerPlaceId: input.providerPlaceId,
      name: input.name,
      address: input.address,
      roadAddress: input.roadAddress ?? null,
      categoryName: input.categoryName ?? null,
      categoryGroupName: input.categoryGroupName ?? null,
      phone: input.phone ?? null,
      lat: input.lat ?? 0,
      lng: input.lng ?? 0,
      mapUrl: input.mapUrl ?? null,
      note: null,
      isFavorite: false,
      savedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.database
      .prepare(
        `
          INSERT INTO places (
            id,
            user_id,
            provider,
            provider_place_id,
            name,
            address,
            road_address,
            category_name,
            category_group_name,
            phone,
            lat,
            lng,
            map_url,
            note,
            is_favorite,
            saved_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        record.id,
        record.userId,
        record.provider,
        record.providerPlaceId,
        record.name,
        record.address,
        record.roadAddress ?? null,
        record.categoryName ?? null,
        record.categoryGroupName ?? null,
        record.phone ?? null,
        record.lat,
        record.lng,
        record.mapUrl ?? null,
        record.note,
        record.isFavorite ? 1 : 0,
        record.savedAt,
        record.createdAt,
        record.updatedAt,
      );

    return record;
  }

  createCollection(input: {
    userId: string;
    name: string;
  }): PlaceCollectionRecord {
    const now = new Date().toISOString();
    const record: PlaceCollectionRecord = {
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      placeIds: [],
      createdAt: now,
      updatedAt: now,
    };

    this.database
      .prepare(
        `
          INSERT INTO place_collections (
            id,
            user_id,
            name,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(
        record.id,
        record.userId,
        record.name,
        record.createdAt,
        record.updatedAt,
      );

    return record;
  }

  deleteCollection(id: string): PlaceCollectionRecord | null {
    const existingCollection = this.findCollectionById(id);

    if (!existingCollection) {
      return null;
    }

    this.database
      .prepare(
        `
          DELETE FROM place_collections
          WHERE id = ?
        `,
      )
      .run(id);

    return existingCollection;
  }

  addPlaceToCollection(
    collectionId: string,
    placeId: string,
  ): PlaceCollectionRecord | null {
    if (!this.findCollectionById(collectionId)) {
      return null;
    }

    const now = new Date().toISOString();

    this.database
      .prepare(
        `
          INSERT OR IGNORE INTO place_collection_places (
            collection_id,
            place_id,
            created_at
          ) VALUES (?, ?, ?)
        `,
      )
      .run(collectionId, placeId, now);

    this.database
      .prepare(
        `
          UPDATE place_collections
          SET updated_at = ?
          WHERE id = ?
        `,
      )
      .run(now, collectionId);

    return this.findCollectionById(collectionId);
  }

  removePlaceFromCollection(
    collectionId: string,
    placeId: string,
  ): PlaceCollectionRecord | null {
    if (!this.findCollectionById(collectionId)) {
      return null;
    }

    const now = new Date().toISOString();

    this.database
      .prepare(
        `
          DELETE FROM place_collection_places
          WHERE collection_id = ? AND place_id = ?
        `,
      )
      .run(collectionId, placeId);

    this.database
      .prepare(
        `
          UPDATE place_collections
          SET updated_at = ?
          WHERE id = ?
        `,
      )
      .run(now, collectionId);

    return this.findCollectionById(collectionId);
  }

  update(
    id: string,
    patch: {
      note?: string | null;
      isFavorite?: boolean;
      roadAddress?: string | null;
      categoryName?: string | null;
      categoryGroupName?: string | null;
      phone?: string | null;
      mapUrl?: string | null;
    },
  ): SavedPlaceRecord | null {
    const existingPlace = this.findById(id);

    if (!existingPlace) {
      return null;
    }

    const nextPlace: SavedPlaceRecord = {
      ...existingPlace,
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.isFavorite !== undefined
        ? { isFavorite: patch.isFavorite }
        : {}),
      ...(patch.roadAddress !== undefined
        ? { roadAddress: patch.roadAddress }
        : {}),
      ...(patch.categoryName !== undefined
        ? { categoryName: patch.categoryName }
        : {}),
      ...(patch.categoryGroupName !== undefined
        ? { categoryGroupName: patch.categoryGroupName }
        : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.mapUrl !== undefined ? { mapUrl: patch.mapUrl } : {}),
      updatedAt: new Date().toISOString(),
    };

    this.database
      .prepare(
        `
          UPDATE places
          SET
            road_address = ?,
            category_name = ?,
            category_group_name = ?,
            phone = ?,
            map_url = ?,
            note = ?,
            is_favorite = ?,
            updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        nextPlace.roadAddress ?? null,
        nextPlace.categoryName ?? null,
        nextPlace.categoryGroupName ?? null,
        nextPlace.phone ?? null,
        nextPlace.mapUrl ?? null,
        nextPlace.note,
        nextPlace.isFavorite ? 1 : 0,
        nextPlace.updatedAt,
        id,
      );

    return nextPlace;
  }

  delete(id: string): SavedPlaceRecord | null {
    const existingPlace = this.findById(id);

    if (!existingPlace) {
      return null;
    }

    this.database.prepare(`DELETE FROM places WHERE id = ?`).run(id);

    return existingPlace;
  }

  private listCollectionMemberships(collectionIds: string[]) {
    const memberships = new Map<string, string[]>();

    if (collectionIds.length === 0) {
      return memberships;
    }

    const placeholders = collectionIds.map(() => '?').join(', ');
    const rows = this.database
      .prepare(
        `
          SELECT
            collection_id AS collectionId,
            place_id AS placeId
          FROM place_collection_places
          WHERE collection_id IN (${placeholders})
          ORDER BY created_at ASC
        `,
      )
      .all(...collectionIds);

    rows.forEach(row => {
      const collectionId = String(row.collectionId);
      const currentPlaceIds = memberships.get(collectionId) ?? [];

      currentPlaceIds.push(String(row.placeId));
      memberships.set(collectionId, currentPlaceIds);
    });

    return memberships;
  }
}

function mapSavedPlaceRow(row: Record<string, unknown>): SavedPlaceRecord {
  return {
    id: String(row.id),
    userId: String(row.userId),
    provider: row.provider as PlaceProvider,
    providerPlaceId: String(row.providerPlaceId),
    name: String(row.name),
    address: String(row.address),
    roadAddress: (row.roadAddress as string | null | undefined) ?? null,
    categoryName: (row.categoryName as string | null | undefined) ?? null,
    categoryGroupName:
      (row.categoryGroupName as string | null | undefined) ?? null,
    phone: (row.phone as string | null | undefined) ?? null,
    lat: Number(row.lat),
    lng: Number(row.lng),
    mapUrl: (row.mapUrl as string | null | undefined) ?? null,
    note: (row.note as string | null | undefined) ?? null,
    isFavorite: Boolean(row.isFavorite),
    savedAt: String(row.savedAt),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapCollectionRows(
  rows: Array<Record<string, unknown>>,
  memberships: Map<string, string[]>,
): PlaceCollectionRecord[] {
  return rows.map(row => ({
    id: String(row.id),
    userId: String(row.userId),
    name: String(row.name),
    placeIds: memberships.get(String(row.id)) ?? [],
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  }));
}
