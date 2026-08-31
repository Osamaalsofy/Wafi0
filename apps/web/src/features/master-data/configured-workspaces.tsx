'use client';
import { MasterDataWorkspace, type MasterDataConfig } from './master-data-workspace';

const configs: Record<string, MasterDataConfig> = {
  warehouses: {
    path: '/warehouses',
    title: 'Warehouses',
    singular: 'Warehouse',
    eyebrow: 'TENANT MASTER DATA',
    description: 'Client warehouse locations and operating status',
    permission: 'warehouse',
    fields: [
      {
        key: 'clientId',
        label: 'Client',
        required: true,
        optionsPath: '/clients',
        createOnly: true,
      },
      { key: 'code', label: 'Warehouse code', required: true, createOnly: true },
      { key: 'name', label: 'Warehouse name', required: true },
      { key: 'regionId', label: 'Saudi region', optionsPath: '/regions', submit: false, optionLabel: (record) => `${String(record.nameEn ?? '')} · ${String(record.nameAr ?? '')}` },
      { key: 'governorateId', label: 'Governorate', optionsPath: '/governorates', dependsOn: { fieldKey: 'regionId', optionRelationKey: 'region' }, optionLabel: (record) => `${String(record.nameEn ?? '')} · ${String(record.nameAr ?? '')}` },
      { key: 'address', label: 'Address' },
      { key: 'latitude', label: 'Latitude', type: 'number' },
      { key: 'longitude', label: 'Longitude', type: 'number' },
    ],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
      { key: 'client', label: 'Client' },
      { key: 'address', label: 'Address' },
      { key: 'governorate', label: 'Governorate' },
    ],
  },
  branches: {
    path: '/branches',
    title: 'Branches',
    singular: 'Branch',
    eyebrow: 'TENANT MASTER DATA',
    description: 'Client delivery branches and destinations',
    permission: 'branch',
    fields: [
      {
        key: 'clientId',
        label: 'Client',
        required: true,
        optionsPath: '/clients',
        createOnly: true,
      },
      { key: 'code', label: 'Branch code', required: true, createOnly: true },
      { key: 'name', label: 'Branch name', required: true },
      { key: 'regionId', label: 'Saudi region', optionsPath: '/regions', submit: false, optionLabel: (record) => `${String(record.nameEn ?? '')} · ${String(record.nameAr ?? '')}` },
      { key: 'governorateId', label: 'Governorate', optionsPath: '/governorates', dependsOn: { fieldKey: 'regionId', optionRelationKey: 'region' }, optionLabel: (record) => `${String(record.nameEn ?? '')} · ${String(record.nameAr ?? '')}` },
      { key: 'address', label: 'Address' },
      { key: 'latitude', label: 'Latitude', type: 'number' },
      { key: 'longitude', label: 'Longitude', type: 'number' },
    ],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
      { key: 'client', label: 'Client' },
      { key: 'address', label: 'Address' },
      { key: 'governorate', label: 'Governorate' },
    ],
  },
  carriers: {
    path: '/carriers',
    title: 'Carriers',
    singular: 'Carrier',
    eyebrow: 'TRANSPORT NETWORK',
    description: 'Transport partners available to tenant missions',
    permission: 'carrier',
    fields: [
      { key: 'code', label: 'Carrier code', required: true, createOnly: true },
      { key: 'name', label: 'Carrier name', required: true },
    ],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
      { key: 'createdAt', label: 'Created' },
    ],
  },
  drivers: {
    path: '/drivers',
    title: 'Drivers',
    singular: 'Driver',
    eyebrow: 'FLEET OPERATIONS',
    description: 'Carrier drivers and license details',
    permission: 'driver',
    fields: [
      {
        key: 'carrierId',
        label: 'Carrier',
        required: true,
        optionsPath: '/carriers',
        createOnly: true,
      },
      {
        key: 'clientId',
        label: 'Client',
        required: true,
        optionsPath: '/clients',
      },
      { key: 'name', label: 'Driver name', required: true },
      { key: 'trackingNumber', label: 'Tracking number', required: true },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'licenseNo', label: 'License number' },
    ],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'carrier', label: 'Carrier' },
      { key: 'client', label: 'Client' },
      { key: 'trackingNumber', label: 'Tracking number' },
      { key: 'phone', label: 'Phone' },
      { key: 'licenseNo', label: 'License' },
    ],
  },
  vehicles: {
    path: '/vehicles',
    title: 'Vehicles',
    singular: 'Vehicle',
    eyebrow: 'FLEET OPERATIONS',
    description: 'Carrier vehicles, types, and capacity',
    permission: 'vehicle',
    fields: [
      {
        key: 'carrierId',
        label: 'Carrier',
        required: true,
        optionsPath: '/carriers',
        createOnly: true,
      },
      { key: 'plateNo', label: 'Plate number', required: true },
      { key: 'vehicleType', label: 'Vehicle type' },
      { key: 'capacity', label: 'Capacity', type: 'number' },
      { key: 'capacityUnit', label: 'Capacity unit' },
    ],
    columns: [
      { key: 'plateNo', label: 'Plate' },
      { key: 'carrier', label: 'Carrier' },
      { key: 'vehicleType', label: 'Type' },
      { key: 'capacity', label: 'Capacity' },
    ],
  },
};

function workspace(key: keyof typeof configs, accessToken: string) {
  const config = configs[key];
  if (!config) return null;
  return <MasterDataWorkspace accessToken={accessToken} config={config} />;
}
export function WarehousesWorkspace({ accessToken }: { accessToken: string }) {
  return workspace('warehouses', accessToken);
}
export function BranchesWorkspace({ accessToken }: { accessToken: string }) {
  return workspace('branches', accessToken);
}
export function CarriersWorkspace({ accessToken }: { accessToken: string }) {
  return workspace('carriers', accessToken);
}
export function DriversWorkspace({ accessToken }: { accessToken: string }) {
  return workspace('drivers', accessToken);
}
export function VehiclesWorkspace({ accessToken }: { accessToken: string }) {
  return workspace('vehicles', accessToken);
}
