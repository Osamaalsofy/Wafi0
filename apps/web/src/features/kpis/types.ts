export type SupportedKpiScope =
  'ORGANIZATION' | 'CLIENT' | 'WAREHOUSE' | 'CARRIER' | 'CONTRACT' | 'DRIVER';

export interface KpiDefinition {
  code: string;
  name: string;
  description: string;
}

export interface KpiConfiguration {
  id: string;
  kpiCode: string;
  scopeType: SupportedKpiScope | 'ROUTE';
  scopeId: string;
  version: number;
  isEnabled: boolean;
  formula: Record<string, unknown> | null;
  eligibility: Record<string, unknown> | null;
  dataSources: Record<string, unknown> | null;
  periodDefinition: Record<string, unknown> | null;
  targets: Record<string, unknown> | null;
  targetPercent: string;
  roundingMode: string | null;
  decimalScale: number | null;
  calculationFrequency: string | null;
  timeZone: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  definition: KpiDefinition;
}

interface NamedOption {
  id: string;
  code: string;
  name: string;
}

export interface KpiConfigurationOptions {
  organization: { id: string; name: string };
  definitions: KpiDefinition[];
  scopes: {
    clients: NamedOption[];
    warehouses: Array<NamedOption & { clientId: string }>;
    carriers: NamedOption[];
    contracts: Array<NamedOption & { cadence: string; effectiveTo: string | null }>;
    drivers: Array<{ id: string; carrierId: string; name: string }>;
  };
  unsupportedScopes: Array<'ROUTE'>;
  calculationAvailable: false;
}

export interface CreateKpiConfigurationInput {
  kpiCode: string;
  scopeType: SupportedKpiScope;
  scopeId: string;
  isEnabled: boolean;
  formula?: Record<string, unknown>;
  eligibility?: Record<string, unknown>;
  dataSources?: Record<string, unknown>;
  periodDefinition?: Record<string, unknown>;
  targets?: Record<string, unknown>;
  targetPercent?: number;
  roundingMode?: string;
  decimalScale?: number;
  calculationFrequency?: string;
  timeZone?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}
