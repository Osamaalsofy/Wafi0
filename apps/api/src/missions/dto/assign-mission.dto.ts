import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { MissionAssignmentKind } from '../../../generated/prisma/client';

export class AssignMissionDto {
  @IsUUID() carrierId!: string;
  @IsUUID() vehicleId!: string;
  @IsUUID() driverId!: string;
  @IsOptional() @IsEnum(MissionAssignmentKind) kind?: MissionAssignmentKind;
  @IsOptional() @IsString() @Length(2, 1000) reason?: string;
}
