import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateCarrierDto {
  @ApiProperty({ example: 'CARRIER_A' })
  @IsString()
  @Length(2, 64)
  @Matches(/^[A-Z0-9][A-Z0-9_-]*$/)
  code!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  settings?: Record<string, string | number | boolean | null>;
}
