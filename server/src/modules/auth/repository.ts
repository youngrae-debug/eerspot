import { randomBytes, randomUUID } from 'node:crypto';

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

export class InMemoryAuthRepository {
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
        token: `atk_${randomBytes(24).toString('hex')}`,
        userId,
        expiresAt: accessExpiresAt,
      },
      refresh: {
        token: `rtk_${randomBytes(32).toString('hex')}`,
        userId,
        expiresAt: refreshExpiresAt,
      },
    };
  }
}
