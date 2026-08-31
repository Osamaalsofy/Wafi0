'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ApiRequestError,
  getCurrentUser,
  login,
  logoutSession,
  refreshSession,
  type AccessSession,
  type CurrentUser,
  type LoginInput,
} from '../../lib/api-client';

type SessionStatus = 'restoring' | 'authenticated' | 'anonymous' | 'error';

interface SessionContextValue {
  status: SessionStatus;
  session?: AccessSession;
  user?: CurrentUser;
  error?: string;
  signIn(input: LoginInput): Promise<void>;
  signOut(): Promise<void>;
  retry(): Promise<void>;
  hasPermission(permission: string): boolean;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('restoring');
  const [session, setSession] = useState<AccessSession>();
  const [user, setUser] = useState<CurrentUser>();
  const [error, setError] = useState<string>();

  const establish = useCallback(async (nextSession: AccessSession, signal?: AbortSignal) => {
    const currentUser = await getCurrentUser(nextSession.accessToken, signal);
    setSession(nextSession);
    setUser(currentUser);
    setError(undefined);
    setStatus('authenticated');
  }, []);

  const restore = useCallback(async () => {
    setStatus('restoring');
    setError(undefined);
    try {
      await establish(await refreshSession());
    } catch (requestError) {
      setSession(undefined);
      setUser(undefined);
      if (requestError instanceof ApiRequestError && requestError.status === 401) {
        setStatus('anonymous');
      } else {
        setError(
          requestError instanceof Error ? requestError.message : 'Unable to restore session',
        );
        setStatus('error');
      }
    }
  }, [establish]);

  useEffect(() => {
    queueMicrotask(() => void restore());
  }, [restore]);

  useEffect(() => {
    if (!session || status !== 'authenticated') return;
    const timer = window.setTimeout(
      () => {
        void refreshSession()
          .then((nextSession) => establish(nextSession))
          .catch(() => {
            setSession(undefined);
            setUser(undefined);
            setStatus('anonymous');
          });
      },
      Math.max((session.expiresIn - 30) * 1000, 1000),
    );
    return () => window.clearTimeout(timer);
  }, [establish, session, status]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      session,
      user,
      error,
      async signIn(input) {
        setStatus('restoring');
        setError(undefined);
        try {
          await establish(await login(input));
        } catch (requestError) {
          setStatus('anonymous');
          const message =
            requestError instanceof Error ? requestError.message : 'Unable to sign in';
          setError(message);
          throw requestError;
        }
      },
      async signOut() {
        try {
          await logoutSession();
        } finally {
          setSession(undefined);
          setUser(undefined);
          setError(undefined);
          setStatus('anonymous');
        }
      },
      retry: restore,
      hasPermission(permission) {
        return user?.grants.some((grant) => grant.permission === permission) ?? false;
      },
    }),
    [error, establish, restore, session, status, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}
