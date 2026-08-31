export const OPERATIONS_QUEUE = 'wafi-operations';

export const JOB_NAMES = {
  slaReevaluation: 'sla-reevaluation',
  alertDelivery: 'alert-delivery',
  alertEscalation: 'alert-escalation',
  dailyKpi: 'daily-kpi-generation',
  contractExpiration: 'contract-expiration',
  documentProcessing: 'document-processing',
  scheduledReports: 'scheduled-reporting',
} as const;

export type OperationsJobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
