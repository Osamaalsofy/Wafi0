import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ClosureStage } from '../../../generated/prisma/client';

export class ListClosurePoliciesQueryDto {
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsEnum(ClosureStage) stage?: ClosureStage;
}
