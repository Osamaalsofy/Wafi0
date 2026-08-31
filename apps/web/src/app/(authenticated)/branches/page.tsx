import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { BranchesWorkspace } from '../../../features/master-data/configured-workspaces';
export default function Page() {
  return <AuthorizedWorkspace component={BranchesWorkspace} />;
}
