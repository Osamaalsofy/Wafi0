import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListGovernoratesQueryDto {
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(200) limit = 50;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsUUID() regionId?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() majorOnly?: boolean;
}
