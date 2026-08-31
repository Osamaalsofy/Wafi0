'use client';

import type { MapLayerId } from '../types/map';

const layers: Array<{ id: MapLayerId; en: string; ar: string }> = [
  { id: 'locations', en: 'Saudi locations', ar: 'المواقع السعودية' },
  { id: 'missions', en: 'Missions', ar: 'المهام' },
  { id: 'vehicles', en: 'Vehicles', ar: 'المركبات' },
  { id: 'warehouses', en: 'Warehouses', ar: 'المستودعات' },
  { id: 'routes', en: 'Routes', ar: 'المسارات' },
  { id: 'exceptions', en: 'Exceptions', ar: 'الاستثناءات' },
];

export function MapLayerControl({
  arabic,
  visibleLayers,
  onToggle,
}: {
  arabic: boolean;
  visibleLayers: Record<MapLayerId, boolean>;
  onToggle: (layer: MapLayerId) => void;
}) {
  return (
    <fieldset className="map-layer-control">
      <legend>{arabic ? 'طبقات الخريطة' : 'Map layers'}</legend>
      {layers.map((layer) => (
        <label key={layer.id}>
          <input
            type="checkbox"
            checked={visibleLayers[layer.id]}
            onChange={() => onToggle(layer.id)}
          />
          <span className={`layer-swatch layer-${layer.id}`} aria-hidden="true" />
          {arabic ? layer.ar : layer.en}
        </label>
      ))}
      <span className="map-layer-disabled" aria-disabled="true">
        {arabic ? 'السياج الجغرافي · قريبًا' : 'Geofences · future'}
      </span>
    </fieldset>
  );
}
