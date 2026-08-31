import { AuthenticatedApp } from '../../features/auth/authenticated-app';
import { SessionProvider } from '../../features/auth/session-provider';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthenticatedApp>{children}</AuthenticatedApp>
    </SessionProvider>
  );
}
