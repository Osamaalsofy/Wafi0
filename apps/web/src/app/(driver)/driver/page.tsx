import type { Metadata } from 'next';
import { DriverPortalApp } from '../../../features/portals/driver-portal-app';

export const metadata: Metadata = { title: 'Driver Portal', description: 'Secure WAFI driver assignment workspace.', robots: { index: false, follow: false } };
export default function DriverPage() { return <DriverPortalApp />; }
