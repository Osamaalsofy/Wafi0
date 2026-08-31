export type ExceptionSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
export type ExceptionStatus = 'OPEN' | 'RESOLVED';

interface PersonSummary {
  id: string;
  name: string;
}

export interface OperationalExceptionSummary {
  id: string;
  ruleCode: string;
  status: ExceptionStatus;
  severity: ExceptionSeverity | null;
  isBlocking: boolean;
  openedAt: string;
  lastDetectedAt: string;
  delayMinutes: number | null;
  actualQuantity: string | null;
  owner: PersonSummary | null;
  mission: { id: string; missionNo: string; status: string };
  stop: { id: string; sequence: number; status: string } | null;
  definition: { code: string; name: string };
}

export interface PaginatedExceptions {
  data: OperationalExceptionSummary[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface OperationalExceptionDetail extends OperationalExceptionSummary {
  clientId: string;
  warehouseId: string;
  carrierId: string | null;
  routeId: string | null;
  vehicleId: string | null;
  driverId: string | null;
  scheduledAt: string | null;
  actualAt: string | null;
  resolvedAt: string | null;
  toleranceQuantity: string | null;
  context: Record<string, unknown>;
  resolutionNotes: string | null;
  affectedStops: Array<{ stop: { id: string; sequence: number; branch: { name: string } } }>;
  evidence: Array<{
    purpose: string | null;
    document: { id: string; type: string; originalFileName: string; verificationStatus: string };
  }>;
  rootCauses: Array<{
    id: string;
    category: string;
    description: string;
    confirmedAt: string | null;
    confirmedBy: PersonSummary | null;
  }>;
  decisions: Array<{
    id: string;
    decisionText: string;
    decidedAt: string;
    decidedBy: PersonSummary;
    actions: Array<{
      id: string;
      actionText: string;
      status: 'OPEN' | 'COMPLETED';
      dueAt: string | null;
      completionNotes: string | null;
      owner: PersonSummary;
    }>;
  }>;
}
