import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ReportQueryDto {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() carrierId?: string;
  @IsOptional() @IsUUID() driverId?: string;
  @IsOptional() @IsUUID() missionId?: string;
}
