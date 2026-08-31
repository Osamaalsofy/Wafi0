import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ListMissionEventsQueryDto {
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) limit = 50;
}
