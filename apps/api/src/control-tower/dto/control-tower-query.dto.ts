import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import type { MissionStatus } from '../../../generated/prisma/client';

const ACTIVE_STATUSES = [
  'DRAFT',
  'ASSIGNED',
  'WAITING_FOR_VEHICLE',
  'VEHICLE_ARRIVED',
  'LOADING',
  'LOADED',
  'DEPARTED',
  'IN_TRANSIT',
  'AT_STOP',
  'DELIVERING',
  'DELIVERED',
  'OPERATIONALLY_CLOSED',
  'ACCOUNTING_READY',
] as const satisfies readonly MissionStatus[];

export class ControlTowerQueryDto {
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsUUID() carrierId?: string;
  @IsOptional() @IsIn(ACTIVE_STATUSES) status?: (typeof ACTIVE_STATUSES)[number];
  @IsOptional() @IsString() search?: string;
}
