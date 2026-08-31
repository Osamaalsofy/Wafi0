import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { DocumentVerificationStatus } from '../../../generated/prisma/client';

export class VerifyDocumentDto {
  @IsEnum(DocumentVerificationStatus) status!: DocumentVerificationStatus;
  @IsOptional() @IsString() @Length(1, 1000) notes?: string;
}
