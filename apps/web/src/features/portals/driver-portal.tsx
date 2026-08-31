'use client';
import { PortalDashboard } from './portal-dashboard';
export function DriverPortal({ accessToken }: { accessToken: string }) {
  return <PortalDashboard accessToken={accessToken} kind="driver" />;
}
