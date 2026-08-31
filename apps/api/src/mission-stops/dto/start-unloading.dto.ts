import { IsDateString, IsOptional } from 'class-validator';

export class StartUnloadingDto {
  @IsOptional() @IsDateString() occurredAt?: string;
}
