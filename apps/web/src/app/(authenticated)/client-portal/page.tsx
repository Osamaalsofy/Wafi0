import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { ClientPortal } from '../../../features/portals/client-portal';
export default function ClientPortalPage() {
  return <AuthorizedWorkspace component={ClientPortal} />;
}
