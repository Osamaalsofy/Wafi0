import { IsOptional, IsString, Length } from 'class-validator';

export class CompleteActionDto {
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}
