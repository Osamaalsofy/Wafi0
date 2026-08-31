import { IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateMissionDto {
  @IsString() @Length(1, 80) missionNo!: string;
  @IsUUID() clientId!: string;
  @IsOptional() @IsUUID() contractId?: string;
  @IsOptional() @IsUUID() routeId?: string;
  @IsUUID() warehouseId!: string;
  @IsOptional() @IsString() @Length(1, 120) cargoType?: string;
  @IsOptional() @IsDateString() scheduledLoadingAt?: string;
  @IsOptional() @IsDateString() scheduledDepartureAt?: string;
  @IsOptional() @IsString() @Length(1, 4000) notes?: string;
}
