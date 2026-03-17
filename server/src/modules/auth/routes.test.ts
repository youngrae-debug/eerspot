import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../../app.js';

test('auth flow supports signup, login, refresh rotation, and logout', async () => {
  const app = buildApp();

  const signupResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: {
      email: 'user@example.com',
      password: 'Secret123!',
    },
  });

  assert.equal(signupResponse.statusCode, 201);
  const signupBody = signupResponse.json();
  assert.equal(signupBody.data.email, 'user@example.com');

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: 'user@example.com',
      password: 'Secret123!',
    },
  });

  assert.equal(loginResponse.statusCode, 200);
  const loginBody = loginResponse.json();
  assert.ok(loginBody.data.accessToken);
  assert.ok(loginBody.data.refreshToken);
  assert.equal(loginBody.data.user.email, 'user@example.com');

  const firstRefreshToken = loginBody.data.refreshToken as string;

  const refreshResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: {
      refreshToken: firstRefreshToken,
    },
  });

  assert.equal(refreshResponse.statusCode, 200);
  const refreshBody = refreshResponse.json();
  assert.notEqual(refreshBody.data.refreshToken, firstRefreshToken);

  const oldRefreshResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: {
      refreshToken: firstRefreshToken,
    },
  });

  assert.equal(oldRefreshResponse.statusCode, 401);

  const logoutResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout',
    payload: {
      refreshToken: refreshBody.data.refreshToken,
    },
  });

  assert.equal(logoutResponse.statusCode, 204);

  const revokedRefreshResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: {
      refreshToken: refreshBody.data.refreshToken,
    },
  });

  assert.equal(revokedRefreshResponse.statusCode, 401);

  await app.close();
});

test('duplicate signup returns conflict', async () => {
  const app = buildApp();

  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: {
      email: 'duplicate@example.com',
      password: 'Secret123!',
    },
  });

  const duplicateResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: {
      email: 'duplicate@example.com',
      password: 'Secret123!',
    },
  });

  assert.equal(duplicateResponse.statusCode, 409);
  assert.equal(duplicateResponse.json().error.code, 'CONFLICT');

  await app.close();
});
