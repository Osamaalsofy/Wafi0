import { AlertDeliveryOutcome } from '../../../generated/prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class RecordAlertDeliveryAttemptDto {
  @IsEnum(AlertDeliveryOutcome) outcome!: AlertDeliveryOutcome;
  @IsDateString() attemptedAt!: string;
  @IsOptional() @IsString() @Length(1, 2000) error?: string;
}
