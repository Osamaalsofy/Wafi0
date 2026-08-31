import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';
import {
  ClosureStage,
  DocumentRequirementScope,
  DocumentType,
} from '../../../generated/prisma/client';

export class ClosureDocumentRequirementDto {
  @IsEnum(DocumentType) documentType!: DocumentType;
  @IsEnum(DocumentRequirementScope) scope!: DocumentRequirementScope;
}

export class SaveClosurePolicyDto {
  @IsUUID() clientId!: string;
  @IsEnum(ClosureStage) stage!: ClosureStage;
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ClosureDocumentRequirementDto)
  requirements!: ClosureDocumentRequirementDto[];
}
