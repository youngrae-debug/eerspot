export type AuthUserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthUser = Pick<AuthUserRecord, 'id' | 'email'>;

export type RefreshSessionRecord = {
  token: string;
  userId: string;
  expiresAt: string;
};

export type AccessSessionRecord = {
  token: string;
  userId: string;
  expiresAt: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type LoginResult = AuthTokens & {
  user: AuthUser;
};
