import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { ClientsWorkspace } from '../../../features/clients/clients-workspace';

export default function ClientsPage() {
  return <AuthorizedWorkspace component={ClientsWorkspace} />;
}
