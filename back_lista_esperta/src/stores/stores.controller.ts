import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public, Roles } from '../auth/decorators.js';
import { StoreMemberRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StoreMemberGuard, StoreRoles } from './store-member.guard.js';
import {
  ClaimableQueryDto,
  CreateStoreDto,
  CreateStoreResponseDto,
  MyStoreResponseDto,
  NearbyQueryDto,
  NearbyStoresResponseDto,
  StoreResponseDto,
  UpdateStoreDto,
  VerificationResponseDto,
  VerifyStoreDto,
} from './stores.dto.js';
import { StoresService } from './stores.service.js';
import { VerificationService } from './verification.service.js';

export class StoreMemberResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ example: 'Ana' })
  displayName: string;

  @ApiProperty({ enum: StoreMemberRole, enumName: 'StoreMemberRole' })
  memberRole: StoreMemberRole;
}

@ApiTags('stores')
@Controller('stores')
export class StoresController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoresService,
    private readonly verification: VerificationService,
  ) {}

  /** Stores around a point (default 5 km), closest first. No account needed. */
  @Public()
  @Get('nearby')
  @ApiOkResponse({ type: NearbyStoresResponseDto })
  nearby(@Query() query: NearbyQueryDto): Promise<NearbyStoresResponseDto> {
    return this.stores.nearby(query);
  }

  /** Onboarding: stores close to the merchant's shop that may already be theirs. */
  @Get('claimable')
  @Roles('MERCHANT', 'ADMIN')
  @ApiCookieAuth()
  @ApiOkResponse({ type: [StoreResponseDto] })
  claimable(@Query() query: ClaimableQueryDto): Promise<StoreResponseDto[]> {
    return this.stores.claimable(query);
  }

  @Get('mine')
  @Roles('MERCHANT', 'ADMIN')
  @ApiCookieAuth()
  @ApiOkResponse({ type: [MyStoreResponseDto] })
  mine(@CurrentUser() user: AuthUser): Promise<MyStoreResponseDto[]> {
    return this.stores.mine(user.id);
  }

  @Post()
  @Roles('MERCHANT')
  @ApiCookieAuth()
  @ApiCreatedResponse({ type: CreateStoreResponseDto })
  @ApiConflictResponse({
    description: 'POSSIBLE_DUPLICATE or CNPJ_TAKEN: claim the existing store',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStoreDto,
  ): Promise<CreateStoreResponseDto> {
    return this.stores.create(user.id, dto);
  }

  @Patch(':storeId')
  @Roles('MERCHANT', 'ADMIN')
  @UseGuards(StoreMemberGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ type: StoreResponseDto })
  @ApiForbiddenResponse({ description: 'Not a member of this store' })
  update(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateStoreDto,
  ): Promise<StoreResponseDto> {
    return this.stores.update(storeId, dto);
  }

  /** Checks the CNPJ at the Receita Federal and stores it. Owner only. */
  @Post(':storeId/verification')
  @HttpCode(HttpStatus.OK)
  @Roles('MERCHANT', 'ADMIN')
  @UseGuards(StoreMemberGuard)
  @StoreRoles('OWNER')
  @ApiCookieAuth()
  @ApiOkResponse({ type: VerificationResponseDto })
  @ApiUnprocessableEntityResponse({
    description: 'CNPJ_NOT_FOUND or CNPJ_NOT_ACTIVE',
  })
  @ApiServiceUnavailableResponse({
    description: 'The CNPJ registry did not answer',
  })
  verify(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: VerifyStoreDto,
  ): Promise<VerificationResponseDto> {
    return this.verification.verifyStore(storeId, dto.cnpj);
  }

  /** The store team ("Equipe da loja"). */
  @Get(':storeId/members')
  @Roles('MERCHANT', 'ADMIN')
  @UseGuards(StoreMemberGuard)
  @ApiCookieAuth()
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
