import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { ExceptionSeverity, RuleScopeType, ScopeType } from '../../../generated/prisma/client';

export class CreateRuleConfigurationDto {
  @IsString() @Length(2, 120) ruleCode!: string;
  @IsEnum(RuleScopeType) scopeType!: RuleScopeType;
  @IsUUID() scopeId!: string;
  @IsOptional() @Type(() => Number) @IsInt() priority = 0;
  @IsOptional() @IsBoolean() isEnabled = true;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) thresholdMinutes?: number;
  @IsOptional() @Type(() => Number) @Min(0) quantityTolerance?: number;
  @IsOptional() @IsEnum(ExceptionSeverity) severity?: ExceptionSeverity;
  @IsOptional() @IsBoolean() isBlocking = false;
  @IsOptional() @IsUUID() ownerUserId?: string;
  @IsOptional() @IsEnum(ScopeType) ownerScopeType?: ScopeType;
  @IsOptional() @IsUUID() ownerScopeId?: string;
  @IsOptional() @IsString() @Length(1, 80) timeZone?: string;
  @IsOptional() @IsObject() workingCalendar?: Record<string, unknown>;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}
