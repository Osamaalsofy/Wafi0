import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { RoutesWorkspace } from '../../../features/routes/routes-workspace';
export default function RoutesPage() {
  return <AuthorizedWorkspace component={RoutesWorkspace} />;
}
