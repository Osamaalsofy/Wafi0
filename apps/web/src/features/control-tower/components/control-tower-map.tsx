'use client';

import { useEffect, useRef, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { ControlTowerMapModel, MapLayerId } from '../types/map';
import { MapLayerControl } from './map-layer-control';

const sourceId = 'wafi-operational-map';
const routeSourceId = 'wafi-operational-routes';

function pointCollection(model: ControlTowerMapModel) {
  return {
    type: 'FeatureCollection' as const,
    features: model.points.map((point) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point.longitude, point.latitude] },
      properties: {
        id: point.id,
        missionId: point.missionId ?? '',
        label: point.label,
        kind: point.kind,
        tone: point.tone,
        locationAccuracy: point.locationAccuracy,
      },
    })),
  };
}

function routeCollection(model: ControlTowerMapModel) {
  return {
    type: 'FeatureCollection' as const,
    features: model.routes.map((route) => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: route.coordinates },
      properties: { id: route.id, missionId: route.missionId },
    })),
  };
}

const toneColor = [
  'match',
  ['get', 'tone'],
  'critical',
  '#ef4056',
  'warning',
  '#f3a636',
  'inactive',
  '#82918f',
  '#39d69f',
] as maplibregl.ExpressionSpecification;

export function ControlTowerMap({
  model,
  arabic,
  visibleLayers,
  onToggleLayer,
  onSelectMission,
  locations,
  focusLocationId,
  onFocusLocation,
}: {
  model: ControlTowerMapModel;
  arabic: boolean;
  visibleLayers: Record<MapLayerId, boolean>;
  onToggleLayer: (layer: MapLayerId) => void;
  onSelectMission: (missionId: string) => void;
  locations: Array<{ id: string; nameAr: string; nameEn: string; latitude: string; longitude: string }>;
  focusLocationId: string;
  onFocusLocation: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectRef = useRef(onSelectMission);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    selectRef.current = onSelectMission;
  }, [onSelectMission]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;
    void import('maplibre-gl').then((MapLibre) => {
      if (disposed || !containerRef.current) return;
      const map = new MapLibre.Map({
        container: containerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [45.1, 23.8],
        zoom: 4.25,
        minZoom: 3.4,
        maxZoom: 14,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new MapLibre.NavigationControl({ showCompass: true }), 'bottom-left');
      map.addControl(new MapLibre.AttributionControl({ compact: true }), 'bottom-right');
      map.on('load', () => {
        if (disposed) return;
        map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource(routeSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'wafi-routes',
          type: 'line',
          source: routeSourceId,
          paint: { 'line-color': '#58a9e8', 'line-width': 2, 'line-opacity': 0.72, 'line-dasharray': [2, 2] },
        });
        for (const kind of ['governorate', 'warehouse', 'mission', 'vehicle', 'exception'] as const) {
          map.addLayer({
            id: `wafi-${kind}`,
            type: 'circle',
            source: sourceId,
            filter: ['==', ['get', 'kind'], kind],
            paint: {
              'circle-color': kind === 'governorate' ? '#7d9e98' : kind === 'warehouse' ? '#f6c85f' : toneColor,
              'circle-radius': kind === 'governorate' ? 3 : kind === 'warehouse' ? 7 : kind === 'exception' ? 9 : 8,
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
              'circle-opacity': kind === 'vehicle' ? 0.86 : 1,
            },
          });
          map.addLayer({
            id: `wafi-${kind}-labels`,
            type: 'symbol',
            source: sourceId,
            minzoom: kind === 'governorate' ? 3.4 : 5,
            maxzoom: kind === 'governorate' ? 7 : 24,
            filter: ['==', ['get', 'kind'], kind],
            layout: {
              'text-field': ['get', 'label'],
              'text-size': 10,
              'text-offset': [0, 1.55],
              'text-anchor': 'top',
              'text-allow-overlap': false,
            },
            paint: { 'text-color': '#eef7f5', 'text-halo-color': '#07110f', 'text-halo-width': 1.2 },
          });
        }
        for (const kind of ['mission', 'vehicle', 'exception'] as const) {
          map.on('click', `wafi-${kind}`, (event: maplibregl.MapLayerMouseEvent) => {
            const missionId = event.features?.[0]?.properties?.missionId as string | undefined;
            if (missionId) selectRef.current(missionId);
          });
          map.on('mouseenter', `wafi-${kind}`, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', `wafi-${kind}`, () => { map.getCanvas().style.cursor = ''; });
        }
        setMapReady(true);
      });
      map.on('error', () => setMapError(true));
    });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    (map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined)?.setData(pointCollection(model));
    (map.getSource(routeSourceId) as maplibregl.GeoJSONSource | undefined)?.setData(routeCollection(model));
  }, [mapReady, model]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const visibility: Array<[string, boolean]> = [
      ['wafi-governorate', visibleLayers.locations],
      ['wafi-governorate-labels', visibleLayers.locations],
      ['wafi-routes', visibleLayers.routes],
      ['wafi-warehouse', visibleLayers.warehouses],
      ['wafi-warehouse-labels', visibleLayers.warehouses],
      ['wafi-mission', visibleLayers.missions],
      ['wafi-mission-labels', visibleLayers.missions],
      ['wafi-vehicle', visibleLayers.vehicles],
      ['wafi-vehicle-labels', visibleLayers.vehicles],
      ['wafi-exception', visibleLayers.exceptions],
      ['wafi-exception-labels', visibleLayers.exceptions],
    ];
    for (const [id, visible] of visibility)
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }, [mapReady, visibleLayers]);

  useEffect(() => {
    const map = mapRef.current;
    const location = locations.find(({ id }) => id === focusLocationId);
    if (!mapReady || !map) return;
    if (!focusLocationId) {
      map.flyTo({ center: [45.1, 23.8], zoom: 4.25, essential: true });
      return;
    }
    if (!location) return;
    map.flyTo({ center: [Number(location.longitude), Number(location.latitude)], zoom: 8, essential: true });
  }, [focusLocationId, locations, mapReady]);

  return (
    <section className="control-map-shell" aria-label={arabic ? 'خريطة العمليات في السعودية' : 'Saudi Arabia operations map'}>
      <div className="control-map-header">
        <div><span className="live-indicator" /> {arabic ? 'الوضع المباشر' : 'LIVE OPERATIONS'}</div>
        <label className="map-location-focus"><span className="sr-only">{arabic ? 'الانتقال إلى محافظة' : 'Navigate to governorate'}</span><select aria-label={arabic ? 'الانتقال إلى محافظة' : 'Navigate to governorate'} value={focusLocationId} onChange={(event) => onFocusLocation(event.target.value)}><option value="">{arabic ? 'عرض المملكة' : 'Saudi national view'}</option>{locations.map((location) => <option key={location.id} value={location.id}>{arabic ? location.nameAr : location.nameEn}</option>)}</select></label>
        <small>{arabic ? 'لا تتوفر بيانات GPS مباشرة' : 'Live GPS is not connected'}</small>
      </div>
      <div ref={containerRef} className="control-map-canvas" />
      {!model.points.length ? (
        <div className="control-map-empty">
          <strong>{arabic ? 'لا توجد مواقع تشغيلية لعرضها' : 'No operational locations to display'}</strong>
          <span>{arabic ? 'ستظهر المواقع عند توفر إحداثيات مستودع أو مدينة مسار.' : 'Locations appear when warehouse coordinates or a route city are available.'}</span>
        </div>
      ) : null}
      {mapError ? <p className="control-map-error">{arabic ? 'تعذر تحميل طبقة الخريطة الأساسية.' : 'The base map could not be loaded.'}</p> : null}
      <MapLayerControl arabic={arabic} visibleLayers={visibleLayers} onToggle={onToggleLayer} />
      <div className="map-legend" aria-label={arabic ? 'دليل الحالات' : 'Status legend'}>
        <span><i className="normal" />{arabic ? 'طبيعي' : 'Normal'}</span>
        <span><i className="warning" />{arabic ? 'تحذير' : 'At risk'}</span>
        <span><i className="critical" />{arabic ? 'حرج' : 'Critical'}</span>
      </div>
    </section>
  );
}
