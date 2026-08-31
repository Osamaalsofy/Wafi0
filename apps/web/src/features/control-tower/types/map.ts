import type { ControlTowerMission } from '../types';

export type MapLayerId = 'locations' | 'missions' | 'vehicles' | 'warehouses' | 'routes' | 'exceptions';

export interface MapLayerDefinition {
  id: MapLayerId;
  labelKey: string;
  available: boolean;
}

export interface OperationalMapPoint {
  id: string;
  missionId?: string;
  longitude: number;
  latitude: number;
  label: string;
  kind: 'governorate' | 'mission' | 'vehicle' | 'warehouse' | 'exception';
  tone: 'normal' | 'warning' | 'critical' | 'inactive';
  locationAccuracy: 'exact' | 'city-fallback' | 'reference-center';
}

export interface OperationalMapRoute {
  id: string;
  missionId: string;
  coordinates: Array<[number, number]>;
}

export interface ControlTowerMapModel {
  points: OperationalMapPoint[];
  routes: OperationalMapRoute[];
  missionsById: Map<string, ControlTowerMission>;
  currentTimestamp: string;
  selectedTimestamp: string | null;
  liveMode: boolean;
  mapSnapshot: null;
}

/** Future telemetry contract only. Administrative IDs must come from a spatial/geofence engine, never nearest-centre inference. */
export interface VehiclePosition {
  vehicleId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKph?: number;
  heading?: number;
  accuracyMeters?: number;
  regionId?: string;
  governorateId?: string;
}
