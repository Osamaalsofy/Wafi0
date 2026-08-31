export const RULE_CODES = {
  loadingDelay: 'LOADING_DELAY',
  departureDelay: 'DEPARTURE_DELAY',
  stopArrivalDelay: 'STOP_ARRIVAL_DELAY',
  shortage: 'SHORTAGE',
  rejection: 'REJECTION',
  missingOperationalData: 'MISSING_OPERATIONAL_DATA',
  routeDeviation: 'ROUTE_DEVIATION',
} as const;

export type RuleCode = (typeof RULE_CODES)[keyof typeof RULE_CODES];
