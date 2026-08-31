import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
export class AssignSupportTicketDto {
  @IsUUID() assignedToUserId!: string;
  @IsOptional() @IsString() @Length(2, 1000) reason?: string;
}
