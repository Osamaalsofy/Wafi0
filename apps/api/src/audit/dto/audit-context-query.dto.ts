import { IsIn, IsUUID } from 'class-validator';

export const AUDIT_CONTEXT_TYPES = [
  'EXCEPTION',
  'RULE_CONFIGURATION',
  'KPI_CONFIGURATION',
  'CONTRACT',
  'ROUTE',
  'MISSION',
  'ALERT',
] as const;

export type AuditContextType = (typeof AUDIT_CONTEXT_TYPES)[number];

export class AuditContextQueryDto {
  @IsIn(AUDIT_CONTEXT_TYPES) contextType!: AuditContextType;
  @IsUUID() contextId!: string;
}
