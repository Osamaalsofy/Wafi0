import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { DocumentsWorkspace } from '../../../features/documents/documents-workspace';

export default function DocumentsPage() {
  return <AuthorizedWorkspace component={DocumentsWorkspace} />;
}
