import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { MISSION_STATUSES } from '../mission.constants';

export class ListMissionsQueryDto {
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsUUID() carrierId?: string;
  @IsOptional() @IsIn(MISSION_STATUSES) status?: (typeof MISSION_STATUSES)[number];
  @IsOptional() @IsString() search?: string;
  @IsOptional()
  @IsIn(['missionNo', 'scheduledLoadingAt', 'createdAt'])
  sortBy: 'missionNo' | 'scheduledLoadingAt' | 'createdAt' = 'createdAt';
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
}
