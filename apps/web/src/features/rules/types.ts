import type { ExceptionSeverity } from '../exceptions/types';

export type SupportedRuleScope = 'ORGANIZATION' | 'CLIENT' | 'WAREHOUSE' | 'CARRIER' | 'CONTRACT';

export interface RuleDefinition {
  code: string;
  name: string;
  description: string;
  defaultThresholdMinutes: number | null;
  defaultQuantityTolerance: string | null;
  enabledByDefault: boolean;
}

export interface RuleConfiguration {
  id: string;
  ruleCode: string;
  scopeType: SupportedRuleScope | 'ROUTE' | 'DRIVER';
  scopeId: string;
  priority: number;
  version: number;
  isEnabled: boolean;
  thresholdMinutes: number | null;
  quantityTolerance: string | null;
  severity: ExceptionSeverity | null;
  isBlocking: boolean;
  ownerUserId: string | null;
  timeZone: string | null;
  workingCalendar: Record<string, unknown> | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  definition: RuleDefinition;
  owner: { id: string; name: string } | null;
}

interface NamedOption {
  id: string;
  code: string;
  name: string;
}

export interface RuleConfigurationOptions {
  organization: { id: string; name: string };
  definitions: RuleDefinition[];
  scopes: {
    clients: NamedOption[];
    warehouses: Array<NamedOption & { clientId: string }>;
    carriers: NamedOption[];
    contracts: Array<NamedOption & { cadence: string; effectiveTo: string | null }>;
  };
  owners: Array<{ id: string; name: string; email: string }>;
  unsupportedScopes: Array<'ROUTE' | 'DRIVER'>;
}

export interface CreateRuleConfigurationInput {
  ruleCode: string;
  scopeType: SupportedRuleScope;
  scopeId: string;
  priority: number;
  isEnabled: boolean;
  thresholdMinutes?: number;
  quantityTolerance?: number;
  severity?: ExceptionSeverity;
  isBlocking: boolean;
  ownerUserId?: string;
  timeZone?: string;
  workingCalendar?: Record<string, unknown>;
  effectiveFrom: string;
  effectiveTo?: string;
}
