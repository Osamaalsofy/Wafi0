import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateRootCauseDto {
  @IsString() @Length(1, 120) category!: string;
  @IsString() @Length(1, 2000) description!: string;
  @IsOptional() @IsBoolean() confirmed = false;
}
