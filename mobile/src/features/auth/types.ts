export type AuthUser = {
  id: string;
  email: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type StoredAuthSession = {
  refreshToken: string;
  user: AuthUser;
};
