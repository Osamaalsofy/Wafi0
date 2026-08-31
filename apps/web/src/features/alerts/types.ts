import type { OperationalExceptionSummary } from '../exceptions/types';

export interface OperationalAlert {
  id: string;
  exceptionId: string;
  userId: string | null;
  channel: string;
  status: 'PENDING' | 'SENT' | 'READ' | 'FAILED';
  sentAt: string | null;
  readAt: string | null;
  escalationDueAt: string;
  escalatedAt: string | null;
  createdAt: string;
  deliveryAttempts: Array<{
    id: string;
    attemptNo: number;
    channel: string;
    outcome: 'SENT' | 'FAILED';
    attemptedAt: string;
    error: string | null;
    nextAttemptAt: string | null;
  }>;
  escalations: Array<{
    id: string;
    escalatedAt: string;
    recipient: { id: string; name: string; email: string };
  }>;
  exception: OperationalExceptionSummary;
}

export interface PaginatedAlerts {
  data: OperationalAlert[];
  summary: { unread: number };
  meta: { page: number; limit: number; total: number; totalPages: number };
}
