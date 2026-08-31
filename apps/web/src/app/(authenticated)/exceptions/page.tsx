import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { ExceptionWorkspace } from '../../../features/exceptions/exception-workspace';

export default function ExceptionsPage() {
  return <AuthorizedWorkspace component={ExceptionWorkspace} />;
}
