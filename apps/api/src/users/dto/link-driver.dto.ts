import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class LinkDriverDto {
  @IsOptional()
  @IsUUID()
  driverId?: string | null;
  @IsOptional() @IsString() @Length(10, 20) @Matches(/^\d+$/) nationalId?: string;
}
