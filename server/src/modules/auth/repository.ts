import { randomBytes, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import type {
  AccessSessionRecord,
  AuthTokens,
  AuthUserRecord,
  RefreshSessionRecord,
} from './types.js';

type SessionPair = {
  access: AccessSessionRecord;
  refresh: RefreshSessionRecord;
};

export type AuthRepository = {
  findUserByEmail: (email: string) => AuthUserRecord | null;
  findUserById: (userId: string) => AuthUserRecord | null;
  createUser: (input: {
    email: string;
    passwordHash: string;
  }) => AuthUserRecord;
  issueTokens: (userId: string) => AuthTokens;
  rotateRefreshToken: (refreshToken: string) => AuthTokens | null;
  findRefreshSession: (token: string) => RefreshSessionRecord | null;
  findAccessSession: (token: string) => AccessSessionRecord | null;
  revokeRefreshToken: (token: string) => void;
};

export class InMemoryAuthRepository implements AuthRepository {
  private readonly usersByEmail = new Map<string, AuthUserRecord>();
  private readonly usersById = new Map<string, AuthUserRecord>();
  private readonly refreshSessions = new Map<string, RefreshSessionRecord>();
  private readonly accessSessions = new Map<string, AccessSessionRecord>();

  findUserByEmail(email: string): AuthUserRecord | null {
    return this.usersByEmail.get(email.toLowerCase()) ?? null;
  }

  findUserById(userId: string): AuthUserRecord | null {
    return this.usersById.get(userId) ?? null;
  }

  createUser(input: {
    email: string;
    passwordHash: string;
  }): AuthUserRecord {
    const normalizedEmail = input.email.toLowerCase();
    const now = new Date().toISOString();
    const user: AuthUserRecord = {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    this.usersByEmail.set(normalizedEmail, user);
    this.usersById.set(user.id, user);

    return user;
  }

  issueTokens(userId: string): AuthTokens {
    const pair = this.createSessionPair(userId);

    this.accessSessions.set(pair.access.token, pair.access);
    this.refreshSessions.set(pair.refresh.token, pair.refresh);

    return {
      accessToken: pair.access.token,
      refreshToken: pair.refresh.token,
    };
  }

  rotateRefreshToken(refreshToken: string): AuthTokens | null {
    const currentSession = this.refreshSessions.get(refreshToken);

    if (!currentSession) {
      return null;
    }

    this.refreshSessions.delete(refreshToken);

    const nextPair = this.createSessionPair(currentSession.userId);
    this.accessSessions.set(nextPair.access.token, nextPair.access);
    this.refreshSessions.set(nextPair.refresh.token, nextPair.refresh);

    return {
      accessToken: nextPair.access.token,
      refreshToken: nextPair.refresh.token,
    };
  }

  findRefreshSession(token: string): RefreshSessionRecord | null {
    return this.refreshSessions.get(token) ?? null;
  }

  findAccessSession(token: string): AccessSessionRecord | null {
    return this.accessSessions.get(token) ?? null;
  }

  revokeRefreshToken(token: string): void {
    this.refreshSessions.delete(token);
  }

  private createSessionPair(userId: string): SessionPair {
    const accessExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const refreshExpiresAt = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000,
    ).toISOString();

    return {
      access: {
        token: createAccessToken(),
        userId,
        expiresAt: accessExpiresAt,
      },
      refresh: {
        token: createRefreshToken(),
        userId,
        expiresAt: refreshExpiresAt,
      },
    };
  }
}

export class SQLiteAuthRepository implements AuthRepository {
  constructor(private readonly database: DatabaseSync) {}

  findUserByEmail(email: string): AuthUserRecord | null {
    const normalizedEmail = email.toLowerCase();

    return (
      (this.database
        .prepare(
          `
            SELECT
              id,
              email,
              password_hash AS passwordHash,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM auth_users
            WHERE email = ?
          `,
        )
        .get(normalizedEmail) as AuthUserRecord | undefined) ?? null
    );
  }

  findUserById(userId: string): AuthUserRecord | null {
    return (
      (this.database
        .prepare(
          `
            SELECT
              id,
              email,
              password_hash AS passwordHash,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM auth_users
            WHERE id = ?
          `,
        )
        .get(userId) as AuthUserRecord | undefined) ?? null
    );
  }

  createUser(input: {
    email: string;
    passwordHash: string;
  }): AuthUserRecord {
    const normalizedEmail = input.email.toLowerCase();
    const now = new Date().toISOString();
    const user: AuthUserRecord = {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    this.database
      .prepare(
        `
          INSERT INTO auth_users (
            id,
            email,
            password_hash,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(
        user.id,
        user.email,
        user.passwordHash,
        user.createdAt,
        user.updatedAt,
      );

    return user;
  }

  issueTokens(userId: string): AuthTokens {
    const pair = createSessionPair(userId);

    withTransaction(this.database, () => {
      this.database
        .prepare(
          `
            INSERT INTO auth_access_sessions (token, user_id, expires_at)
            VALUES (?, ?, ?)
          `,
        )
        .run(pair.access.token, userId, pair.access.expiresAt);
      this.database
        .prepare(
          `
            INSERT INTO auth_refresh_sessions (token, user_id, expires_at)
            VALUES (?, ?, ?)
          `,
        )
        .run(pair.refresh.token, userId, pair.refresh.expiresAt);
    });

    return {
      accessToken: pair.access.token,
      refreshToken: pair.refresh.token,
    };
  }

  rotateRefreshToken(refreshToken: string): AuthTokens | null {
    const currentSession = this.findRefreshSession(refreshToken);

    if (!currentSession) {
      return null;
    }

    const nextPair = createSessionPair(currentSession.userId);

    withTransaction(this.database, () => {
      this.database
        .prepare(`DELETE FROM auth_refresh_sessions WHERE token = ?`)
        .run(refreshToken);
      this.database
        .prepare(
          `
            INSERT INTO auth_access_sessions (token, user_id, expires_at)
            VALUES (?, ?, ?)
          `,
        )
        .run(nextPair.access.token, currentSession.userId, nextPair.access.expiresAt);
      this.database
        .prepare(
          `
            INSERT INTO auth_refresh_sessions (token, user_id, expires_at)
            VALUES (?, ?, ?)
          `,
        )
        .run(
          nextPair.refresh.token,
          currentSession.userId,
          nextPair.refresh.expiresAt,
        );
    });

    return {
      accessToken: nextPair.access.token,
      refreshToken: nextPair.refresh.token,
    };
  }

  findRefreshSession(token: string): RefreshSessionRecord | null {
    return (
      (this.database
        .prepare(
          `
            SELECT token, user_id AS userId, expires_at AS expiresAt
            FROM auth_refresh_sessions
            WHERE token = ?
          `,
        )
        .get(token) as RefreshSessionRecord | undefined) ?? null
    );
  }

  findAccessSession(token: string): AccessSessionRecord | null {
    return (
      (this.database
        .prepare(
          `
            SELECT token, user_id AS userId, expires_at AS expiresAt
            FROM auth_access_sessions
            WHERE token = ?
          `,
        )
        .get(token) as AccessSessionRecord | undefined) ?? null
    );
  }

  revokeRefreshToken(token: string): void {
    this.database
      .prepare(`DELETE FROM auth_refresh_sessions WHERE token = ?`)
      .run(token);
  }
}

function createAccessToken(): string {
  return `atk_${randomBytes(24).toString('hex')}`;
}

function createRefreshToken(): string {
  return `rtk_${randomBytes(32).toString('hex')}`;
}

function createSessionPair(userId: string): SessionPair {
  const accessExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const refreshExpiresAt = new Date(
    Date.now() + 14 * 24 * 60 * 60 * 1000,
  ).toISOString();

  return {
    access: {
      token: createAccessToken(),
      userId,
      expiresAt: accessExpiresAt,
    },
    refresh: {
      token: createRefreshToken(),
      userId,
      expiresAt: refreshExpiresAt,
    },
  };
}

function withTransaction(database: DatabaseSync, action: () => void): void {
  database.exec('BEGIN');

  try {
    action();
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
