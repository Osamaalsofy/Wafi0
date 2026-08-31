import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { ContractsWorkspace } from '../../../features/contracts/contracts-workspace';
export default function ContractsPage() {
  return <AuthorizedWorkspace component={ContractsWorkspace} />;
}
