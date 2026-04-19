import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openAppDatabase(databasePath: string): DatabaseSync {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);

  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_access_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS auth_refresh_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS places (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_place_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      road_address TEXT,
      category_name TEXT,
      category_group_name TEXT,
      phone TEXT,
      lat REAL NOT NULL DEFAULT 0,
      lng REAL NOT NULL DEFAULT 0,
      map_url TEXT,
      note TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      saved_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, provider, provider_place_id),
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_places_user_saved_at
      ON places(user_id, saved_at DESC);

    CREATE TABLE IF NOT EXISTS place_collections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL COLLATE NOCASE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, name),
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_place_collections_user_updated_at
      ON place_collections(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS place_collection_places (
      collection_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (collection_id, place_id),
      FOREIGN KEY (collection_id) REFERENCES place_collections(id) ON DELETE CASCADE,
      FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_place_collection_places_place_id
      ON place_collection_places(place_id);

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      memo TEXT,
      scheduled_at TEXT NOT NULL,
      place_id TEXT,
      reminder_minutes_before INTEGER,
      visit_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
      FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_user_scheduled_at
      ON schedules(user_id, scheduled_at);

    CREATE INDEX IF NOT EXISTS idx_schedules_user_place_active
      ON schedules(user_id, place_id, deleted_at);
  `);

  try {
    database.exec(
      'ALTER TABLE schedules ADD COLUMN reminder_minutes_before INTEGER',
    );
  } catch {
    // Existing databases may already include the reminder column.
  }

  try {
    database.exec('ALTER TABLE places ADD COLUMN road_address TEXT');
  } catch {
    // Existing databases may already include the road_address column.
  }

  try {
    database.exec('ALTER TABLE places ADD COLUMN category_name TEXT');
  } catch {
    // Existing databases may already include the category_name column.
  }

  try {
    database.exec('ALTER TABLE places ADD COLUMN category_group_name TEXT');
  } catch {
    // Existing databases may already include the category_group_name column.
  }

  try {
    database.exec('ALTER TABLE places ADD COLUMN phone TEXT');
  } catch {
    // Existing databases may already include the phone column.
  }

  try {
    database.exec('ALTER TABLE places ADD COLUMN map_url TEXT');
  } catch {
    // Existing databases may already include the map_url column.
  }

  return database;
}
