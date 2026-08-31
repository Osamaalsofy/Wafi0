import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListWarehousesQueryDto {
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE', 'ARCHIVED']) status?:
    'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  @IsOptional() @IsIn(['name', 'code', 'createdAt']) sortBy: 'name' | 'code' | 'createdAt' = 'name';
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'asc';
}
