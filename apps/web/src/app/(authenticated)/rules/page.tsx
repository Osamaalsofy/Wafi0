import { AuthorizedWorkspace } from '../../../features/auth/authorized-workspace';
import { RuleConfigurationWorkspace } from '../../../features/rules/rule-configuration-workspace';

export default function RulesPage() {
  return <AuthorizedWorkspace component={RuleConfigurationWorkspace} />;
}
