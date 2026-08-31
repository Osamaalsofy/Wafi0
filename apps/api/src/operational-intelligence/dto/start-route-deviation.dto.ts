import { IsDateString } from 'class-validator';

export class StartRouteDeviationDto {
  @IsDateString() occurredAt!: string;
}
