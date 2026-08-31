import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ExceptionSeverity, ExceptionStatus } from '../../../generated/prisma/client';

export class ListExceptionsQueryDto {
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsEnum(ExceptionStatus) status?: ExceptionStatus;
  @IsOptional() @IsEnum(ExceptionSeverity) severity?: ExceptionSeverity;
  @IsOptional() @IsString() ruleCode?: string;
  @IsOptional() @IsUUID() missionId?: string;
  @IsOptional() @IsUUID() ownerUserId?: string;
}
