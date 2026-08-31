import { IsOptional, IsUUID } from 'class-validator';

export class AssignExceptionDto {
  @IsOptional() @IsUUID() ownerUserId?: string;
}
