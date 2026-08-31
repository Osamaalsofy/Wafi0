'use client';

import { useSession } from '../auth/session-provider';
import { ControlTowerDashboard } from './control-tower-dashboard';

export function ControlTowerApp({ embedded = false }: { embedded?: boolean }) {
  const { session, signOut } = useSession();
  if (!session) return null;
  return (
    <ControlTowerDashboard
      accessToken={session.accessToken}
      embedded={embedded}
      onLogout={() => void signOut()}
    />
  );
}
