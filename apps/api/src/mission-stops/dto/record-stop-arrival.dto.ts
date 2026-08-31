import { IsDateString, IsOptional } from 'class-validator';

export class RecordStopArrivalDto {
  @IsOptional() @IsDateString() occurredAt?: string;
}
