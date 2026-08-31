import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class CreateWarehouseDto {
  @IsUUID() clientId!: string;
  @IsString() @Length(2, 64) code!: string;
  @IsString() @Length(2, 160) name!: string;
  @IsOptional() @IsString() @Length(1, 500) address?: string;
  @IsOptional() @IsUUID() governorateId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
}
