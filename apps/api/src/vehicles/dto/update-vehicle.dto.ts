import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpdateVehicleDto {
  @IsOptional() @IsString() @Length(2, 80) vehicleType?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) capacity?: number;
  @IsOptional() @IsString() @Length(1, 32) capacityUnit?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
}
