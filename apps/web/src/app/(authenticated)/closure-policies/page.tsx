import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { ClosurePoliciesWorkspace } from '../../../features/closure-policies/closure-policies-workspace';
export default function ClosurePoliciesPage() {
  return <AuthorizedWorkspace component={ClosurePoliciesWorkspace} />;
}
