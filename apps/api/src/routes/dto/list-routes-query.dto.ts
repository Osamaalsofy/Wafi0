import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { RecordStatus } from '../../../generated/prisma/client';

export class ListRoutesQueryDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
