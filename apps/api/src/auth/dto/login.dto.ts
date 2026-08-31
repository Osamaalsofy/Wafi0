import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'wafi' })
  @IsString()
  @Length(2, 64)
  organizationCode!: string;

  @ApiProperty({ example: 'operator@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(8)
  password!: string;
}
