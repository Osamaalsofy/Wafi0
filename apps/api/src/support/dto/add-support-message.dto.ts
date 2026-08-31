import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';
export class AddSupportMessageDto {
  @IsString() @Length(1, 5000) message!: string;
  @IsOptional() @IsUUID() attachmentDocumentId?: string;
  @IsOptional() @IsBoolean() internalOnly?: boolean;
}
