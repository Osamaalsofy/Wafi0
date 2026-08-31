import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  Max,
} from 'class-validator';
import { RuleScopeType } from '../../../generated/prisma/client';

export class CreateKpiConfigurationDto {
  @IsString() @Length(2, 120) kpiCode!: string;
  @IsEnum(RuleScopeType) scopeType!: RuleScopeType;
  @IsUUID() scopeId!: string;
  @IsOptional() @IsBoolean() isEnabled = false;
  @IsOptional() @IsObject() formula?: Record<string, unknown>;
  @IsOptional() @IsObject() eligibility?: Record<string, unknown>;
  @IsOptional() @IsObject() dataSources?: Record<string, unknown>;
  @IsOptional() @IsObject() periodDefinition?: Record<string, unknown>;
  @IsOptional() @IsObject() targets?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) targetPercent?: number;
  @IsOptional() @IsString() @Length(1, 40) roundingMode?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) decimalScale?: number;
  @IsOptional() @IsIn(['DAILY']) calculationFrequency?: 'DAILY';
  @IsOptional() @IsString() @Length(1, 80) timeZone?: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}
