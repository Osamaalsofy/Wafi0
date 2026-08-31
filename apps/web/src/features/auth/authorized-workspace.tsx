'use client';

import type { ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from './session-provider';

export function AuthorizedWorkspace({
  component: Component,
}: {
  component: ComponentType<{ accessToken: string; onClose?: () => void }>;
}) {
  const { session } = useSession();
  const router = useRouter();
  return session ? (
    <Component accessToken={session.accessToken} onClose={() => router.push('/os/control-tower')} />
  ) : null;
}
