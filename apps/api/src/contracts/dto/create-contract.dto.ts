import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
  IsBoolean,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { ContractCadence, ContractPartyType } from '../../../generated/prisma/client';

export class ContractPartyDto {
  @IsEnum(ContractPartyType)
  partyType!: Exclude<ContractPartyType, 'ORGANIZATION'>;

  @IsUUID()
  partyId!: string;
}

export class CreateContractDto {
  @IsString()
  @Length(2, 80)
  @Matches(/^[A-Z0-9][A-Z0-9_-]*$/)
  code!: string;

  @IsString()
  @Length(2, 160)
  name!: string;

  @IsEnum(ContractCadence)
  cadence!: ContractCadence;

  @IsDateString()
  effectiveFrom!: string;

  @IsDateString()
  effectiveTo!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ContractPartyDto)
  parties!: ContractPartyDto[];

  @IsOptional() @IsBoolean() temperatureMonitoringRequired?: boolean = false;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) minimumTemperature?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) maximumTemperature?: number;
  @IsOptional() @IsNumber() @Min(0) temperatureGraceMinutes?: number;
  @IsOptional() @IsString() @Length(1, 160) temperatureSensorReference?: string;
}
