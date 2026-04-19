import { AppError } from '../../lib/http/errors.js';

import { hashPassword, verifyPassword } from './password.js';
import type { AuthRepository } from './repository.js';
import type { AuthTokens, LoginResult } from './types.js';

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async signUp(input: {
    email: string;
    password: string;
  }): Promise<{ id: string; email: string }> {
    const existingUser = this.repository.findUserByEmail(input.email);

    if (existingUser) {
      throw new AppError(409, 'CONFLICT', 'email already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const user = this.repository.createUser({
      email: input.email,
      passwordHash,
    });

    return {
      id: user.id,
      email: user.email,
    };
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<LoginResult> {
    const user = this.repository.findUserByEmail(input.email);

    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'invalid email or password');
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(401, 'UNAUTHORIZED', 'invalid email or password');
    }

    const tokens = this.repository.issueTokens(user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  async refresh(input: { refreshToken: string }): Promise<AuthTokens> {
    const refreshSession = this.repository.findRefreshSession(input.refreshToken);

    if (!refreshSession) {
      throw new AppError(401, 'UNAUTHORIZED', 'invalid refresh token');
    }

    if (new Date(refreshSession.expiresAt).getTime() <= Date.now()) {
      this.repository.revokeRefreshToken(input.refreshToken);
      throw new AppError(401, 'UNAUTHORIZED', 'refresh token expired');
    }

    const user = this.repository.findUserById(refreshSession.userId);

    if (!user) {
      this.repository.revokeRefreshToken(input.refreshToken);
      throw new AppError(401, 'UNAUTHORIZED', 'invalid refresh token');
    }

    const tokens = this.repository.rotateRefreshToken(input.refreshToken);

    if (!tokens) {
      throw new AppError(401, 'UNAUTHORIZED', 'invalid refresh token');
    }

    return tokens;
  }

  async logout(input: { refreshToken: string }): Promise<void> {
    this.repository.revokeRefreshToken(input.refreshToken);
  }

  async authenticate(
    authorizationHeader: string | undefined,
  ): Promise<{ id: string; email: string }> {
    if (!authorizationHeader) {
      throw new AppError(401, 'UNAUTHORIZED', 'missing authorization header');
    }

    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppError(401, 'UNAUTHORIZED', 'invalid authorization header');
    }

    const accessSession = this.repository.findAccessSession(token);

    if (!accessSession) {
      throw new AppError(401, 'UNAUTHORIZED', 'invalid access token');
    }

    if (new Date(accessSession.expiresAt).getTime() <= Date.now()) {
      throw new AppError(401, 'UNAUTHORIZED', 'access token expired');
    }

    const user = this.repository.findUserById(accessSession.userId);

    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'invalid access token');
    }

    return {
      id: user.id,
      email: user.email,
    };
  }
}
