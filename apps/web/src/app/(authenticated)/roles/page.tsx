import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { RolesWorkspace } from '../../../features/roles/roles-workspace';
export default function Page() {
  return <AuthorizedWorkspace component={RolesWorkspace} />;
}
