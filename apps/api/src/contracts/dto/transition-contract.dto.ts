import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ContractStatus } from '../../../generated/prisma/client';

export class TransitionContractDto {
  @IsEnum(ContractStatus) status!: ContractStatus;
  @IsOptional() @IsString() @Length(2, 1000) reason?: string;
}
