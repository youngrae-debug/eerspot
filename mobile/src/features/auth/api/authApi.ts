import { request } from '../../../shared/api/http';

import type { AuthSession } from '../types';

type Credentials = {
  email: string;
  password: string;
};

type SignUpResponse = {
  id: string;
  email: string;
};

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

export async function signUp(credentials: Credentials): Promise<SignUpResponse> {
  return request<SignUpResponse>('/auth/signup', {
    method: 'POST',
    body: credentials,
  });
}

export async function login(credentials: Credentials): Promise<AuthSession> {
  return request<AuthSession>('/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

export async function refresh(refreshToken: string): Promise<RefreshResponse> {
  return request<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await request<void>('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
  });
}
