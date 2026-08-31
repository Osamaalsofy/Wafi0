import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { WarehousesWorkspace } from '../../../features/master-data/configured-workspaces';
export default function Page() {
  return <AuthorizedWorkspace component={WarehousesWorkspace} />;
}
