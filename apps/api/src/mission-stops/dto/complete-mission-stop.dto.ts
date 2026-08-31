import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { QuantityUnit } from '../../../generated/prisma/client';

export class CompleteMissionStopDto {
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) receivedQty?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  actualQuantity?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) rejectedQty?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) shortageQty?: number;
  @IsOptional() @IsString() @Length(1, 4000) notes?: string;
  @IsOptional() @IsEnum(QuantityUnit) unit?: QuantityUnit;
}
