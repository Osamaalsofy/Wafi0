import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ContractCadence, ContractStatus } from '../../../generated/prisma/client';

export class ListContractsQueryDto {
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
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional()
  @IsEnum(ContractCadence)
  cadence?: ContractCadence;

  @IsOptional()
  @IsUUID()
  clientId?: string;
}
