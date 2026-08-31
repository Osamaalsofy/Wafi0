import type { Metadata } from 'next';
import { ClientPortalApp } from '../../../features/portals/client-portal-app';

export const metadata: Metadata = {
  title: 'Client Portal',
  description: 'Secure WAFI customer shipment and document workspace.',
  robots: { index: false, follow: false },
};

export default function ClientPortalSignInPage() {
  return <ClientPortalApp />;
}
