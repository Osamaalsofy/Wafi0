import { IsDateString } from 'class-validator';

export class RecoverRouteDeviationDto {
  @IsDateString() returnedAt!: string;
}
