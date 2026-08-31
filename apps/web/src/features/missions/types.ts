import type { MissionStatus } from '../control-tower/types';

export interface MissionListItem {
  id: string;
  missionNo: string;
  status: MissionStatus;
  cargoType: string | null;
  scheduledLoadingAt: string | null;
  createdAt: string;
  client: { id: string; code: string; name: string };
  warehouse: { id: string; code: string; name: string };
  carrier: { id: string; code: string; name: string } | null;
  vehicle: { id: string; plateNo: string } | null;
  driver: { id: string; name: string } | null;
  route: { id: string; code: string; name: string; cityRegion: string; timeZone: string } | null;
}

export interface PaginatedMissions {
  data: MissionListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface MissionWriteInput {
  missionNo: string;
  clientId: string;
  contractId?: string | null;
  routeId?: string | null;
  warehouseId: string;
  cargoType?: string;
  scheduledLoadingAt?: string;
  scheduledDepartureAt?: string;
  notes?: string;
}

export interface MissionStopWriteInput {
  branchId: string;
  sequence: number;
  expectedArrival?: string;
  expectedQty?: number;
  notes?: string;
}

export interface CompleteMissionStopInput {
  receivedQty?: number;
  rejectedQty?: number;
  shortageQty?: number;
  notes?: string;
}

export interface AvailableMissionTransitions {
  status: MissionStatus;
  transitions: MissionStatus[];
}

export interface EntityOption {
  id: string;
  code?: string;
  name?: string;
  plateNo?: string;
  clientId?: string;
  carrierId?: string;
  status: string;
}
