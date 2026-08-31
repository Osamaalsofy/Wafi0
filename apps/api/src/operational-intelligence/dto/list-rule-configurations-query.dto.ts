import { IsOptional, IsString } from 'class-validator';

export class ListRuleConfigurationsQueryDto {
  @IsOptional() @IsString() ruleCode?: string;
}
