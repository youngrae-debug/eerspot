import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { AuthProvider, useAuth } from '../src/features/auth/context/AuthContext';

jest.mock('../src/features/auth/api/authApi', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  refresh: jest.fn(),
  signUp: jest.fn(),
}));

jest.mock('../src/features/auth/storage/sessionStorage', () => ({
  clearStoredSession: jest.fn(async () => undefined),
  loadStoredSession: jest.fn(async () => null),
  saveStoredSession: jest.fn(async () => undefined),
}));

const authApi = jest.requireMock('../src/features/auth/api/authApi') as {
  login: jest.Mock;
  signUp: jest.Mock;
};

const sessionStorage = jest.requireMock(
  '../src/features/auth/storage/sessionStorage',
) as {
  saveStoredSession: jest.Mock;
};

type Controls = {
  signIn: (email: string, password: string) => Promise<void>;
};

function AuthHarness({
  onReady,
}: {
  onReady: (controls: Controls) => void;
}): React.JSX.Element {
  const { session, signIn, status } = useAuth();

  React.useEffect(() => {
    onReady({ signIn });
  }, [onReady, signIn]);

  return (
    <Text>
      {status}:{session?.user.email ?? 'none'}
    </Text>
  );
}

afterEach(() => {
  authApi.login.mockReset();
  authApi.signUp.mockReset();
  sessionStorage.saveStoredSession.mockReset();
});

test('signIn auto-provisions an account when login fails first', async () => {
  let controls!: Controls;
  let instance!: ReactTestRenderer.ReactTestRenderer;

  authApi.login
    .mockRejectedValueOnce(new Error('not found'))
    .mockResolvedValueOnce({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        email: 'user@example.com',
        id: 'usr_1',
      },
    });
  authApi.signUp.mockResolvedValueOnce({
    email: 'user@example.com',
    id: 'usr_1',
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <AuthProvider>
        <AuthHarness
          onReady={nextControls => {
            controls = nextControls;
          }}
        />
      </AuthProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    await controls.signIn('user@example.com', 'Secret123!');
  });

  expect(authApi.signUp).toHaveBeenCalledWith({
    email: 'user@example.com',
    password: 'Secret123!',
  });
  expect(sessionStorage.saveStoredSession).toHaveBeenCalledWith({
    refreshToken: 'refresh-token',
    user: {
      email: 'user@example.com',
      id: 'usr_1',
    },
  });
  expect(instance.root.findByType(Text).props.children.join('')).toBe(
    'authenticated:user@example.com',
  );
});
