import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DocumentType } from '../../../generated/prisma/client';

export class UploadDocumentDto {
  @IsUUID() missionId!: string;
  @IsOptional() @IsUUID() stopId?: string;
  @IsEnum(DocumentType) type!: DocumentType;
  @IsOptional() @IsUUID() replacesDocumentId?: string;
}
