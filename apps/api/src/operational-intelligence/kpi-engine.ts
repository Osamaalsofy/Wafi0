import { createHash } from 'node:crypto';

export const KPI_COMPONENT_WEIGHTS = {
  VEHICLE_ARRIVAL: 25,
  LOADING_DEPARTURE: 20,
  DELIVERY_ARRIVAL: 25,
  ROUTE_COMPLIANCE: 10,
  POD_DOCUMENT: 10,
  OPERATIONAL_SAFETY: 5,
  TEMPERATURE: 5,
} as const;

export type KpiComponentCode = keyof typeof KPI_COMPONENT_WEIGHTS;

export interface KpiMissionInput {
  missionId: string;
  clientId: string;
  carrierId: string | null;
  driverId: string | null;
  status: string;
  scheduledLoadingAt: string | null;
  actualLoadingAt: string | null;
  scheduledDepartureAt: string | null;
  actualDepartureAt: string | null;
  stops: Array<{
    id: string;
    expectedArrival: string | null;
    actualArrival: string | null;
    status: string;
  }>;
  documents: Array<{ type: string; verificationStatus: string; stopId: string | null }>;
  exceptions: Array<{ ruleCode: string; severity: string | null; statusAtCutoff: string }>;
  events: Array<{ eventType: string; occurredAt: string }>;
  externalDataAvailability: Record<string, { available: boolean; source: string | null }>;
  temperatureMonitoringRequired: boolean;
}

export interface KpiComponentResult {
  code: KpiComponentCode;
  weight: number;
  applicable: boolean;
  available: boolean;
  score: number | null;
  reason: string;
}

export interface KpiMissionScore {
  missionId: string;
  score: number | null;
  applicableWeight: number;
  targetMet: boolean | null;
  components: KpiComponentResult[];
}

const time = (value: string | null) => (value ? new Date(value).getTime() : null);

const compliance = (actual: string | null, scheduled: string | null, toleranceMinutes: number) => {
  const actualMs = time(actual);
  const scheduledMs = time(scheduled);
  if (scheduledMs === null) return { applicable: false, available: false, score: null };
  if (actualMs === null) return { applicable: true, available: false, score: null };
  return {
    applicable: true,
    available: true,
    score: actualMs <= scheduledMs + toleranceMinutes * 60_000 ? 100 : 0,
  };
};

const component = (
  code: KpiComponentCode,
  values: Pick<KpiComponentResult, 'applicable' | 'available' | 'score'>,
  reason: string,
): KpiComponentResult => ({ code, weight: KPI_COMPONENT_WEIGHTS[code], ...values, reason });

export function calculateMissionKpi(input: KpiMissionInput, targetPercent = 90): KpiMissionScore {
  const vehicleArrivalEvent = input.events.find((event) => event.eventType === 'VEHICLE_ARRIVED');
  const vehicleArrival = compliance(
    vehicleArrivalEvent?.occurredAt ?? null,
    input.scheduledLoadingAt,
    0,
  );

  const loading = compliance(input.actualLoadingAt, input.scheduledLoadingAt, 15);
  const departure = compliance(input.actualDepartureAt, input.scheduledDepartureAt, 30);
  const internalMovementScores = [loading, departure].filter(
    (item) => item.applicable && item.available && item.score !== null,
  );
  const movementApplicable = loading.applicable || departure.applicable;
  const movementAvailable = internalMovementScores.length > 0;
  const movementScore = movementAvailable
    ? internalMovementScores.reduce((sum, item) => sum + (item.score ?? 0), 0) /
      internalMovementScores.length
    : null;

  const eligibleStops = input.stops.filter((stop) => stop.status !== 'CANCELLED');
  const deliveryParts = eligibleStops.map((stop) =>
    compliance(stop.actualArrival, stop.expectedArrival, 15),
  );
  const availableDelivery = deliveryParts.filter(
    (item) => item.applicable && item.available && item.score !== null,
  );
  const deliveryApplicable = deliveryParts.some((item) => item.applicable);
  const deliveryScore = availableDelivery.length
    ? availableDelivery.reduce((sum, item) => sum + (item.score ?? 0), 0) / availableDelivery.length
    : null;

  const routeAvailable = input.externalDataAvailability.gps?.available === true;
  const routeDeviation = input.exceptions.some(
    (exception) => exception.ruleCode === 'ROUTE_DEVIATION' && exception.statusAtCutoff === 'OPEN',
  );

  const podApplicable = eligibleStops.length > 0;
  const verifiedPodStops = new Set(
    input.documents
      .filter((document) => document.type === 'POD' && document.verificationStatus === 'VERIFIED')
      .map((document) => document.stopId)
      .filter((stopId): stopId is string => stopId !== null),
  );
  const podScore = podApplicable
    ? (eligibleStops.filter((stop) => verifiedPodStops.has(stop.id)).length /
        eligibleStops.length) *
      100
    : null;
  const podJoinAvailable = podApplicable;

  const safetyProviderAvailable =
    input.externalDataAvailability.accident?.available === true ||
    input.exceptions.some((exception) => exception.ruleCode === 'ACCIDENT');
  const safetyIncident = input.exceptions.some((exception) =>
    ['ACCIDENT', 'OPERATIONAL_SAFETY'].includes(exception.ruleCode),
  );

  const temperatureAvailable = input.externalDataAvailability.temperature?.available === true;
  const temperatureException = input.exceptions.some(
    (exception) => exception.ruleCode === 'TEMPERATURE_DEVIATION',
  );

  const components = [
    component('VEHICLE_ARRIVAL', vehicleArrival, 'Vehicle-arrived event versus scheduled loading'),
    component(
      'LOADING_DEPARTURE',
      {
        applicable: movementApplicable,
        available: movementAvailable,
        score: movementScore,
      },
      'Applicable loading and departure compliance facts',
    ),
    component(
      'DELIVERY_ARRIVAL',
      {
        applicable: deliveryApplicable,
        available: availableDelivery.length > 0,
        score: deliveryScore,
      },
      'Eligible stop arrivals versus expected arrival',
    ),
    component(
      'ROUTE_COMPLIANCE',
      {
        applicable: input.events.some((event) => event.eventType === 'DEPARTED'),
        available: routeAvailable,
        score: routeAvailable ? (routeDeviation ? 0 : 100) : null,
      },
      'Provider GPS data and route-deviation incidents',
    ),
    component(
      'POD_DOCUMENT',
      {
        applicable: podApplicable,
        available: podJoinAvailable,
        score: podJoinAvailable ? podScore : null,
      },
      'Verified POD obligations for eligible stops',
    ),
    component(
      'OPERATIONAL_SAFETY',
      {
        applicable: true,
        available: safetyProviderAvailable,
        score: safetyProviderAvailable ? (safetyIncident ? 0 : 100) : null,
      },
      'Available accident or internal safety incident data',
    ),
    component(
      'TEMPERATURE',
      {
        applicable: input.temperatureMonitoringRequired,
        available: input.temperatureMonitoringRequired && temperatureAvailable,
        score:
          input.temperatureMonitoringRequired && temperatureAvailable
            ? temperatureException
              ? 0
              : 100
            : null,
      },
      input.temperatureMonitoringRequired
        ? 'Contract requires temperature monitoring'
        : 'Temperature monitoring is not applicable to this mission',
    ),
  ];

  const scored = components.filter(
    (item) => item.applicable && item.available && item.score !== null,
  );
  const applicableWeight = scored.reduce((sum, item) => sum + item.weight, 0);
  const score = applicableWeight
    ? Math.round(
        (scored.reduce((sum, item) => sum + (item.score ?? 0) * item.weight, 0) /
          applicableWeight) *
          100,
      ) / 100
    : null;
  return {
    missionId: input.missionId,
    score,
    applicableWeight,
    targetMet: score === null ? null : score >= targetPercent,
    components,
  };
}

export function hashKpiInputs(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
