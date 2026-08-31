import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { DriverPortal } from '../../../features/portals/driver-portal';
export default function DriverPortalPage() {
  return <AuthorizedWorkspace component={DriverPortal} />;
}
