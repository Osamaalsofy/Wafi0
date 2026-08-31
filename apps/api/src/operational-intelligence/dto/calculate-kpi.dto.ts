import { IsEnum, IsISO8601, IsUUID } from 'class-validator';
import { KpiPeriodType } from '../../../generated/prisma/client';

export class CalculateKpiDto {
  @IsUUID() snapshotId!: string;
  @IsEnum(KpiPeriodType) periodType!: KpiPeriodType;
  @IsISO8601({ strict: true }) calculatedAt!: string;
}
