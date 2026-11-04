import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators.js';
import { StoreMemberRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StoreMemberGuard } from './store-member.guard.js';

export class StoreMemberResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ example: 'Ana' })
  displayName: string;

  @ApiProperty({ enum: StoreMemberRole, enumName: 'StoreMemberRole' })
  memberRole: StoreMemberRole;
}

/** Store routes grow in phase 4 (nearby, register, claim). */
@ApiTags('stores')
@ApiCookieAuth()
@Controller('stores')
export class StoresController {
  constructor(private readonly prisma: PrismaService) {}

  /** The store team ("Equipe da loja"). */
  @Get(':storeId/members')
  @Roles('MERCHANT', 'ADMIN')
  @UseGuards(StoreMemberGuard)
  @ApiOkResponse({ type: [StoreMemberResponseDto] })
  @ApiForbiddenResponse({ description: 'Not a member of this store' })
  async members(
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ): Promise<StoreMemberResponseDto[]> {
    const members = await this.prisma.storeMember.findMany({
      where: { storeId },
      include: { user: { select: { displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      userId: m.userId,
      displayName: m.user.displayName,
      memberRole: m.memberRole,
    }));
  }
}
