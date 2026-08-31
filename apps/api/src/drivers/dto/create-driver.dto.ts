import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateDriverDto {
  @IsUUID() carrierId!: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsString() @Length(2, 160) name!: string;
  @IsOptional() @IsString() @Length(5, 32) @Matches(/^[+0-9() -]+$/) phone?: string;
  @IsOptional() @IsString() @Length(2, 80) licenseNo?: string;
  @IsOptional() @IsString() @Length(2, 80) trackingNumber?: string;
  @IsOptional() @IsString() @Length(10, 20) @Matches(/^\d+$/) nationalId?: string;
}
