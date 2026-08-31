import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { ReportsWorkspace } from '../../../features/reports/reports-workspace';

export default function FinancePage() {
  return <AuthorizedWorkspace component={ReportsWorkspace} />;
}
