'use client';

import { useState } from 'react';
import type { MapLayerId } from '../types/map';

const defaults: Record<MapLayerId, boolean> = {
  locations: true,
  missions: true,
  vehicles: true,
  warehouses: true,
  routes: true,
  exceptions: true,
};

export function useMapLayers() {
  const [visibleLayers, setVisibleLayers] = useState(defaults);
  return {
    visibleLayers,
    toggleLayer(layer: MapLayerId) {
      setVisibleLayers((current) => ({ ...current, [layer]: !current[layer] }));
    },
  };
}
