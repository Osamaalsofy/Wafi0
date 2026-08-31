import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class AttachEvidenceDto {
  @IsUUID() documentId!: string;
  @IsOptional() @IsString() @Length(1, 240) purpose?: string;
}
