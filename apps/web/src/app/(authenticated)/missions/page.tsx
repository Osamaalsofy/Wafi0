import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { MissionsWorkspace } from '../../../features/missions/missions-workspace';

export default function MissionsPage() {
  return <AuthorizedWorkspace component={MissionsWorkspace} />;
}
