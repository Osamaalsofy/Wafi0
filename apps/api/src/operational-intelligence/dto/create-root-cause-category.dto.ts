import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateRootCauseCategoryDto {
  @IsString() @Length(2, 120) @Matches(/^[A-Z][A-Z0-9_]*$/) code!: string;
  @IsString() @Length(2, 160) nameEn!: string;
  @IsString() @Length(2, 160) nameAr!: string;
  @IsOptional() @IsUUID() parentId?: string;
}
