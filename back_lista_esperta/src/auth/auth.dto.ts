import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Length, MaxLength } from 'class-validator';
import { UserResponseDto } from '../users/user-response.dto.js';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Self-service sign-up can only create shoppers and merchants, never admins. */
export const SIGN_UP_ROLES = ['SHOPPER', 'MERCHANT'] as const;
export type SignUpRole = (typeof SIGN_UP_ROLES)[number];

export class RegisterDto {
  @ApiProperty({ example: 'ana@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 128, example: 'uma-senha-longa' })
  @IsString()
  @Length(8, 128)
  password: string;

  @ApiProperty({ example: 'Ana' })
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  displayName: string;

  @ApiProperty({
    enum: SIGN_UP_ROLES,
    description: '"Quero economizar" = SHOPPER, "Tenho uma loja" = MERCHANT',
  })
  @IsIn(SIGN_UP_ROLES)
  role: SignUpRole;
}

export class LoginDto {
  @ApiProperty({ example: 'ana@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'uma-senha-longa' })
  @IsString()
  @Length(1, 128)
  password: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}
