import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { AuditWorkspace } from '../../../features/audit/audit-workspace';
export default function Page() {
  return <AuthorizedWorkspace component={AuditWorkspace} />;
}
