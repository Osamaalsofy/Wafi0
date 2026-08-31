import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { UsersWorkspace } from '../../../features/users/users-workspace';
export default function Page() {
  return <AuthorizedWorkspace component={UsersWorkspace} />;
}
