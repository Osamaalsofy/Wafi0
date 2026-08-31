'use client';
import { PortalDashboard } from './portal-dashboard';
export function ClientPortal({ accessToken }: { accessToken: string }) {
  return <PortalDashboard accessToken={accessToken} kind="client" />;
}
