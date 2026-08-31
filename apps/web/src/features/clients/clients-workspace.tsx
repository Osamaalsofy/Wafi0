'use client';

import { MasterDataWorkspace, type MasterDataConfig } from '../master-data/master-data-workspace';

const config: MasterDataConfig = {
  path: '/clients',
  title: 'Clients',
  singular: 'Client',
  eyebrow: 'TENANT MASTER DATA',
  description: 'Organizations receiving logistics services',
  permission: 'client',
  fields: [
    { key: 'code', label: 'Client code', required: true, createOnly: true },
    { key: 'name', label: 'Client name', required: true },
  ],
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    { key: 'createdAt', label: 'Created' },
  ],
};

export function ClientsWorkspace({ accessToken }: { accessToken: string }) {
  return <MasterDataWorkspace accessToken={accessToken} config={config} />;
}
