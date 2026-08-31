import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { AlertsWorkspace } from '../../../features/alerts/alerts-workspace';

export default function AlertsPage() {
  return <AuthorizedWorkspace component={AlertsWorkspace} />;
}
