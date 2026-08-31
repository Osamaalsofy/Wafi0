import { IsString, Length } from 'class-validator';

export class CreateDecisionDto {
  @IsString() @Length(1, 4000) decisionText!: string;
}
