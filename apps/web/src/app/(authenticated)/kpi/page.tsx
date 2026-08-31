import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { KpiConfigurationWorkspace } from '../../../features/kpis/kpi-configuration-workspace';

export default function KpiPage() {
  return <AuthorizedWorkspace component={KpiConfigurationWorkspace} />;
}
