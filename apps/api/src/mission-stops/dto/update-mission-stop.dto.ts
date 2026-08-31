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
} from 'class-validator';

export class UpdateMissionStopDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) sequence?: number;
  @IsOptional() @IsDateString() expectedArrival?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) expectedQty?: number;
  @IsOptional() @IsEnum(QuantityUnit) quantityUnit?: QuantityUnit;
  @IsOptional() @IsString() @Length(1, 4000) notes?: string;
}
