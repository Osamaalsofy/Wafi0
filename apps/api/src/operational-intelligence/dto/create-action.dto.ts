import { IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateActionDto {
  @IsUUID() ownerUserId!: string;
  @IsString() @Length(1, 4000) actionText!: string;
  @IsOptional() @IsDateString() dueAt?: string;
}
