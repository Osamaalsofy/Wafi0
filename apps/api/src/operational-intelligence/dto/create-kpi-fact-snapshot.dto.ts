import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateKpiFactSnapshotDto {
  @IsUUID() configurationId!: string;
  @IsUUID() idempotencyKey!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) periodDate!: string;
  @IsString() timeZone!: string;
  @IsDateString() sourceCutoffAt!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  missionIds!: string[];
}
