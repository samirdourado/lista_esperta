import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums.js';
import type { User } from '../generated/prisma/client.js';

/** Public view of a user. Never exposes the password hash. */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ana@example.com' })
  email: string;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  role: Role;

  @ApiProperty({ example: 'Ana' })
  displayName: string;

  @ApiProperty({ example: 5 })
  defaultRadiusKm: number;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Stores this user can manage',
  })
  storeIds: string[];

  static from(user: User, storeIds: string[] = []): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      defaultRadiusKm: user.defaultRadiusKm.toNumber(),
      storeIds,
    };
  }
}
