import React, { createContext, useContext, useEffect, useState } from 'react';

import { ApiError, request, type RequestOptions } from '../../../shared/api/http';
import {
  login,
  logout as logoutRequest,
  refresh as refreshRequest,
  signUp as signUpRequest,
} from '../api/authApi';
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
} from '../storage/sessionStorage';
import type { AuthSession } from '../types';

type AuthStatus = 'booting' | 'anonymous' | 'authenticated';

type AuthContextValue = {
  authorizedRequest: <T>(path: string, options?: RequestOptions) => Promise<T>;
  error: string | null;
  isSubmitting: boolean;
  session: AuthSession | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('booting');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const storedSession = await loadStoredSession();

      if (!storedSession) {
        if (isMounted) {
          setStatus('anonymous');
        }
        return;
      }

      try {
        const refreshedTokens = await refreshRequest(storedSession.refreshToken);

        if (!isMounted) {
          return;
        }

        const nextSession: AuthSession = {
          accessToken: refreshedTokens.accessToken,
          refreshToken: refreshedTokens.refreshToken,
          user: storedSession.user,
        };

        setSession(nextSession);
        setStatus('authenticated');
        setError(null);

        await saveStoredSession({
          refreshToken: nextSession.refreshToken,
          user: nextSession.user,
        });
      } catch {
        await clearStoredSession();

        if (isMounted) {
          setSession(null);
          setStatus('anonymous');
          setError(null);
        }
      }
    };

    restoreSession().catch(async () => {
      await clearStoredSession();

      if (isMounted) {
        setSession(null);
        setStatus('anonymous');
        setError(null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const commitSession = async (nextSession: AuthSession) => {
    setSession(nextSession);
    setStatus('authenticated');
    setError(null);

    await saveStoredSession({
      refreshToken: nextSession.refreshToken,
      user: nextSession.user,
    });
  };

  const authenticateWithAutoProvision = async (
    email: string,
    password: string,
  ): Promise<AuthSession> => {
    try {
      return await login({ email, password });
    } catch {
      try {
        await signUpRequest({ email, password });
      } catch {
        // Sign-up is best-effort here. If the account already exists, retry login.
      }

      return login({ email, password });
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const nextSession = await authenticateWithAutoProvision(email, password);
      await commitSession(nextSession);
    } catch (caughtError) {
      setError(extractMessage(caughtError));
      setSession(null);
      setStatus('anonymous');
      throw caughtError;
    } finally {
      setIsSubmitting(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const nextSession = await authenticateWithAutoProvision(email, password);
      await commitSession(nextSession);
    } catch (caughtError) {
      setError(extractMessage(caughtError));
      setSession(null);
      setStatus('anonymous');
      throw caughtError;
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (session) {
        await logoutRequest(session.refreshToken);
      }
    } catch {
      // Logout should remain best-effort on the client.
    } finally {
      await clearStoredSession();
      setSession(null);
      setStatus('anonymous');
      setIsSubmitting(false);
    }
  };

  const authorizedRequest = async <T,>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> => {
    if (!session) {
      throw new Error('authentication required');
    }

    try {
      return await request<T>(path, {
        ...options,
        accessToken: session.accessToken,
      });
    } catch (caughtError) {
      if (!(caughtError instanceof ApiError) || caughtError.status !== 401) {
        throw caughtError;
      }

      try {
        const refreshedTokens = await refreshRequest(session.refreshToken);
        const nextSession: AuthSession = {
          accessToken: refreshedTokens.accessToken,
          refreshToken: refreshedTokens.refreshToken,
          user: session.user,
        };

        await commitSession(nextSession);

        return await request<T>(path, {
          ...options,
          accessToken: nextSession.accessToken,
        });
      } catch (refreshError) {
        await clearStoredSession();
        setSession(null);
        setStatus('anonymous');
        setError('session expired');
        throw refreshError;
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        authorizedRequest,
        error,
        isSubmitting,
        session,
        status,
        signIn,
        signOut,
        signUp,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'unexpected error';
}
