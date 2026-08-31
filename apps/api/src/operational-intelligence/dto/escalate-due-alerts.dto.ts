import { Type } from 'class-transformer';
import { IsDateString, IsInt, Max, Min } from 'class-validator';

export class EscalateDueAlertsDto {
  @IsDateString() evaluatedAt!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
