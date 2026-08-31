import { IsEnum, IsOptional } from 'class-validator';
import { ExceptionSeverity } from '../../../generated/prisma/client';

export class ChangeExceptionSeverityDto {
  @IsOptional() @IsEnum(ExceptionSeverity) severity?: ExceptionSeverity;
}
