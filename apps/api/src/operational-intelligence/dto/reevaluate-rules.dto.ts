import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ReevaluateRulesDto {
  @IsDateString() evaluationAt!: string;
  @IsOptional() @IsUUID() missionId?: string;
  @IsOptional() @IsDateString() scheduledFrom?: string;
  @IsOptional() @IsDateString() scheduledTo?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsDateString() afterUpdatedAt?: string;
  @IsOptional() @IsUUID() afterMissionId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) maxMissions = 100;
}
