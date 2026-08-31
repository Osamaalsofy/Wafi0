import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateSupportTicketDto {
  @IsUUID() missionId!: string;
  @IsString() @Length(2, 200) subject!: string;
  @IsString() @Length(1, 5000) message!: string;
  @IsOptional() @IsUUID() attachmentDocumentId?: string;
}
