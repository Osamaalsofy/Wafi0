import { IsDateString, IsOptional, IsString, IsUUID, Length, ValidateIf } from 'class-validator';

export class UpdateMissionDto {
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsUUID() contractId?:
    string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsUUID() routeId?: string | null;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsString() @Length(1, 120) cargoType?: string;
  @IsOptional() @IsDateString() scheduledLoadingAt?: string;
  @IsOptional() @IsDateString() scheduledDepartureAt?: string;
  @IsOptional() @IsString() @Length(1, 4000) notes?: string;
}
