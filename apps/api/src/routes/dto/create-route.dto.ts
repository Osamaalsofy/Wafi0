import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateRouteStopDto {
  @IsUUID()
  branchId!: string;

  @IsInt()
  @Min(1)
  sequence!: number;
}

export class CreateRouteDto {
  @IsUUID()
  clientId!: string;

  @IsString()
  @Length(2, 80)
  @Matches(/^[A-Z0-9][A-Z0-9_-]*$/)
  code!: string;

  @IsString()
  @Length(2, 160)
  name!: string;

  @IsString()
  @Length(2, 160)
  cityRegion!: string;

  @IsString()
  @Length(2, 80)
  timeZone!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRouteStopDto)
  stops!: CreateRouteStopDto[];
}
