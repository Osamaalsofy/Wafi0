import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateVehicleDto {
  @IsUUID() carrierId!: string;
  @IsString() @Length(2, 40) plateNo!: string;
  @IsOptional() @IsString() @Length(2, 80) vehicleType?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) capacity?: number;
  @IsOptional() @IsString() @Length(1, 32) capacityUnit?: string;
}
