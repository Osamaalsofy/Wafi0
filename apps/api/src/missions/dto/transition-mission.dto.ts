import { IsDateString, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { MISSION_STATUSES } from '../mission.constants';

export class TransitionMissionDto {
  @IsIn(MISSION_STATUSES) toStatus!: (typeof MISSION_STATUSES)[number];
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @IsString() @Length(1, 1000) reason?: string;
}
