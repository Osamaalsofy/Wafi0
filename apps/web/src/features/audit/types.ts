export type AuditContextType =
  | 'EXCEPTION'
  | 'RULE_CONFIGURATION'
  | 'KPI_CONFIGURATION'
  | 'CONTRACT'
  | 'ROUTE'
  | 'MISSION'
  | 'ALERT';

export interface AuditEntry {
  id: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  requestId: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}
