import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class DailyLoadingQueryDto {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsUUID() carrierId?: string;
}
