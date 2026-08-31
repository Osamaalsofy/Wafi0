export type MissionStatus =
  | 'DRAFT'
  | 'ASSIGNED'
  | 'WAITING_FOR_VEHICLE'
  | 'VEHICLE_ARRIVED'
  | 'LOADING'
  | 'LOADED'
  | 'DEPARTED'
  | 'IN_TRANSIT'
  | 'AT_STOP'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'OPERATIONALLY_CLOSED'
  | 'ACCOUNTING_READY'
  | 'CLOSED'
  | 'CANCELLED';

export interface ControlTowerMission {
  id: string;
  missionNo: string;
  status: MissionStatus;
  cargoType: string | null;
  scheduledLoadingAt: string | null;
  updatedAt: string;
  client: { id: string; code: string; name: string };
  warehouse: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    latitude: string | null;
    longitude: string | null;
  };
  carrier: { id: string; code: string; name: string } | null;
  vehicle: { id: string; plateNo: string } | null;
  driver: { id: string; name: string; trackingNumber?: string | null } | null;
  route: {
    id: string;
    code: string;
    name: string;
    cityRegion: string;
    timeZone: string;
  } | null;
  stopProgress: {
    total: number;
    pending: number;
    arrived: number;
    unloading: number;
    completed: number;
    cancelled: number;
  };
  closureReadiness:
    | { applicable: false }
    | {
        applicable: true;
        stage: 'OPERATIONAL_CLOSURE' | 'ACCOUNTING_READINESS';
        policyConfigured: boolean;
        ready: boolean;
        missing: Array<{
          documentType: string;
          scope: 'MISSION' | 'EACH_STOP';
          missingStopIds: string[];
        }>;
      };
  openExceptions: Array<{
    id: string;
    ruleCode: string;
    severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL' | null;
    status: 'OPEN';
    isBlocking: boolean;
    firstDetectedAt: string;
    lastDetectedAt: string;
    definition: { name: string };
    stop: { branch: { id: string; code: string; name: string } } | null;
  }>;
  mapStops: Array<{
    id: string;
    sequence: number;
    status: MissionStopStatus;
    expectedArrival: string | null;
    branch: {
      id: string;
      code: string;
      name: string;
      address: string | null;
      latitude: string | null;
      longitude: string | null;
    };
  }>;
}

export interface ControlTowerResponse {
  summary: {
    totalActive: number;
    byStatus: Record<MissionStatus, number>;
    pageRequiringDocumentAttention: number;
    openExceptions: number;
    criticalExceptions: number;
    delayEvaluation: { available: boolean; reason: string };
  };
  filterOptions: {
    clients: Array<{ id: string; code: string; name: string }>;
    warehouses: Array<{ id: string; clientId: string; code: string; name: string }>;
    carriers: Array<{ id: string; code: string; name: string }>;
    drivers: Array<{
      id: string;
      clientId: string | null;
      name: string;
      profilePhotoDocumentId: string | null;
      _count: { missions: number };
      client: { id: string; name: string } | null;
      carrier: { id: string; code: string; name: string };
    }>;
  };
  data: ControlTowerMission[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export type MissionStopStatus = 'PENDING' | 'ARRIVED' | 'UNLOADING' | 'COMPLETED' | 'CANCELLED';

export interface MissionStop {
  id: string;
  sequence: number;
  status: MissionStopStatus;
  expectedArrival: string | null;
  actualArrival: string | null;
  unloadingStartedAt: string | null;
  unloadingCompletedAt: string | null;
  expectedQty: string | null;
  receivedQty: string | null;
  rejectedQty: string | null;
  shortageQty: string | null;
  notes: string | null;
  branch: { id: string; code: string; name: string };
}

export interface MissionDetail {
  id: string;
  missionNo: string;
  status: MissionStatus;
  cargoType: string | null;
  scheduledLoadingAt: string | null;
  actualLoadingAt: string | null;
  scheduledDepartureAt: string | null;
  actualDepartureAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; code: string; name: string };
  contract: {
    id: string;
    code: string;
    name: string;
    cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL';
    status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  } | null;
  warehouse: { id: string; code: string; name: string };
  carrier: { id: string; code: string; name: string } | null;
  vehicle: { id: string; plateNo: string } | null;
  driver: { id: string; name: string } | null;
  route: {
    id: string;
    code: string;
    name: string;
    cityRegion: string;
    timeZone: string;
    status: 'ACTIVE' | 'INACTIVE';
  } | null;
  stops: MissionStop[];
}

export interface MissionEvent {
  id: string;
  stopId: string | null;
  eventType: string;
  occurredAt: string;
  source: string;
}

export interface MissionDocument {
  id: string;
  stopId: string | null;
  type: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedAt: string | null;
  verificationNotes: string | null;
  createdAt: string;
  stop: { id: string; sequence: number } | null;
  uploadedBy: { id: string; name: string };
  verifiedBy: { id: string; name: string } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
