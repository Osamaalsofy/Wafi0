import { Type } from 'class-transformer';
import { QuantityUnit } from '../../../generated/prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateMissionStopDto {
  @IsUUID() branchId!: string;
  @Type(() => Number) @IsInt() @Min(1) sequence!: number;
  @IsOptional() @IsDateString() expectedArrival?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) expectedQty?: number;
  @ValidateIf(
    (input: CreateMissionStopDto) =>
      input.expectedQty !== undefined || input.quantityUnit !== undefined,
  )
  @IsEnum(QuantityUnit)
  quantityUnit?: QuantityUnit;
  @IsOptional() @IsString() @Length(1, 4000) notes?: string;
}
