import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { DocumentType, DocumentVerificationStatus } from '../../../generated/prisma/client';

export class ListDocumentsQueryDto {
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsUUID() missionId?: string;
  @IsOptional() @IsUUID() stopId?: string;
  @IsOptional() @IsEnum(DocumentType) type?: DocumentType;
  @IsOptional() @IsEnum(DocumentVerificationStatus) verificationStatus?: DocumentVerificationStatus;
}
