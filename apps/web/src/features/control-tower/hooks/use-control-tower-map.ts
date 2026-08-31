'use client';

import { useMemo } from 'react';
import type { ControlTowerMission } from '../types';
import type { ControlTowerMapModel, OperationalMapPoint } from '../types/map';

const cityCoordinates: Record<string, [number, number]> = {
  riyadh: [46.6753, 24.7136],
  الرياض: [46.6753, 24.7136],
  jeddah: [39.1925, 21.4858],
  جدة: [39.1925, 21.4858],
  makkah: [39.8579, 21.3891],
  mecca: [39.8579, 21.3891],
  مكة: [39.8579, 21.3891],
  madinah: [39.5692, 24.5247],
  medina: [39.5692, 24.5247],
  المدينة: [39.5692, 24.5247],
  dammam: [50.1033, 26.4207],
  الدمام: [50.1033, 26.4207],
  khobar: [50.2083, 26.2172],
  الخبر: [50.2083, 26.2172],
  jubail: [49.6583, 27.0174],
  الجبيل: [49.6583, 27.0174],
  qassim: [43.975, 26.2078],
  القصيم: [43.975, 26.2078],
  abha: [42.5053, 18.2164],
  أبها: [42.5053, 18.2164],
  tabuk: [36.5715, 28.3838],
  تبوك: [36.5715, 28.3838],
  jazan: [42.5511, 16.8892],
  جازان: [42.5511, 16.8892],
};

function coordinates(value: { latitude: string | null; longitude: string | null }) {
  if (value.latitude === null || value.longitude === null) return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? ([longitude, latitude] as [number, number])
    : null;
}

function cityFallback(cityRegion?: string | null) {
  if (!cityRegion) return null;
  const normalized = cityRegion.trim().toLowerCase();
  return (
    cityCoordinates[normalized] ??
    Object.entries(cityCoordinates).find(([city]) => normalized.includes(city))?.[1] ??
    null
  );
}

function missionTone(mission: ControlTowerMission): OperationalMapPoint['tone'] {
  if (['CLOSED', 'CANCELLED'].includes(mission.status)) return 'inactive';
  if (mission.openExceptions.some(({ severity }) => severity === 'CRITICAL')) return 'critical';
  if (mission.openExceptions.length) return 'warning';
  return 'normal';
}

export function useControlTowerMap(missions: ControlTowerMission[], referenceLocations: Array<{ id: string; code: string; nameAr: string; nameEn: string; latitude: string; longitude: string; isMajor: boolean }> = [], arabic = false): ControlTowerMapModel {
  return useMemo(() => {
    const points: OperationalMapPoint[] = referenceLocations.filter(({ isMajor }) => isMajor).map((location) => ({
      id: `governorate:${location.id}`,
      longitude: Number(location.longitude),
      latitude: Number(location.latitude),
      label: arabic ? location.nameAr : location.nameEn,
      kind: 'governorate',
      tone: 'inactive',
      locationAccuracy: 'reference-center',
    }));
    const routes: ControlTowerMapModel['routes'] = [];
    const warehouseIds = new Set<string>();

    for (const mission of missions) {
      const warehouseCoordinates = coordinates(mission.warehouse);
      const fallbackCoordinates = cityFallback(mission.route?.cityRegion);
      const origin = warehouseCoordinates ?? fallbackCoordinates;
      if (!origin) continue;
      const accuracy = warehouseCoordinates ? 'exact' : 'city-fallback';

      if (!warehouseIds.has(mission.warehouse.id)) {
        warehouseIds.add(mission.warehouse.id);
        points.push({
          id: `warehouse:${mission.warehouse.id}`,
          longitude: origin[0],
          latitude: origin[1],
          label: mission.warehouse.name,
          kind: 'warehouse',
          tone: 'inactive',
          locationAccuracy: accuracy,
        });
      }

      points.push({
        id: `mission:${mission.id}`,
        missionId: mission.id,
        longitude: origin[0],
        latitude: origin[1],
        label: mission.missionNo,
        kind: 'mission',
        tone: missionTone(mission),
        locationAccuracy: accuracy,
      });
      if (mission.vehicle)
        points.push({
          id: `vehicle:${mission.vehicle.id}:${mission.id}`,
          missionId: mission.id,
          longitude: origin[0] + 0.025,
          latitude: origin[1] + 0.018,
          label: mission.vehicle.plateNo,
          kind: 'vehicle',
          tone: missionTone(mission),
          locationAccuracy: accuracy,
        });
      if (mission.openExceptions.length)
        points.push({
          id: `exception:${mission.openExceptions[0]!.id}`,
          missionId: mission.id,
          longitude: origin[0] - 0.025,
          latitude: origin[1] + 0.018,
          label: `${mission.missionNo} · ${mission.openExceptions.length}`,
          kind: 'exception',
          tone: missionTone(mission),
          locationAccuracy: accuracy,
        });

      const destination = [...(mission.mapStops ?? [])]
        .reverse()
        .map(({ branch }) => coordinates(branch))
        .find((value): value is [number, number] => Boolean(value));
      if (destination && (destination[0] !== origin[0] || destination[1] !== origin[1]))
        routes.push({ id: `route:${mission.id}`, missionId: mission.id, coordinates: [origin, destination] });
    }

    return {
      points,
      routes,
      missionsById: new Map(missions.map((mission) => [mission.id, mission])),
      currentTimestamp: new Date().toISOString(),
      selectedTimestamp: null,
      liveMode: true,
      mapSnapshot: null,
    };
  }, [arabic, missions, referenceLocations]);
}
