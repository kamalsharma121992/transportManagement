'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type SessionUser = {
  id: number;
  name: string;
  username: string;
  role: string;
  pages: string[];
  driverId: number | null;
  driverName: string | null;
};

const SessionContext = createContext<{ user: SessionUser | null; ready: boolean }>({ user: null, ready: false });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled) setUser(body);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  return <SessionContext.Provider value={{ user, ready }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext).user;
}

export function useSessionReady() {
  return useContext(SessionContext).ready;
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login';
}
