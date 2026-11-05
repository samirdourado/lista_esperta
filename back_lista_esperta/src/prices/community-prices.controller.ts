import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';
import type { Actor } from '../auth/auth.types.js';
import { CurrentActor, GUEST_ID_HEADER, Public } from '../auth/decorators.js';
import { OptionalJwtAuthGuard } from '../auth/guards.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class CommunityPriceDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() storeId: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId: string;
  @ApiProperty({ example: 6.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  price: number;
}

class CommunityPriceResponseDto {
  @ApiProperty() id: string;
}

/** "Vi este preço na loja": the lowest-weight source (spec section 5). */
@ApiTags('prices')
@Controller('prices')
export class CommunityPricesController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({
    ip: { limit: 60, ttl: 60_000 },
    default: { limit: 20, ttl: 60_000 },
  })
  @Post('community')
  @ApiHeader({
    name: GUEST_ID_HEADER,
    required: false,
    description: 'Required when not signed in',
  })
  @ApiCreatedResponse({ type: CommunityPriceResponseDto })
  async report(
    @Body() dto: CommunityPriceDto,
    @CurrentActor() actor: Actor,
  ): Promise<CommunityPriceResponseDto> {
    if (!actor.userId && !actor.guestId) {
      throw new BadRequestException({
        code: 'ACTOR_REQUIRED',
        message: `Sign in or send ${GUEST_ID_HEADER}`,
      });
    }
    const [store, product] = await Promise.all([
      this.prisma.store.findUnique({
        where: { id: dto.storeId },
        select: { id: true },
      }),
      this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { id: true },
      }),
    ]);
    if (!store || !product)
      throw new NotFoundException('Store or product not found');
    const row = await this.prisma.priceObservation.create({
      data: {
        storeId: dto.storeId,
        productId: dto.productId,
        price: dto.price,
        source: 'COMMUNITY',
        reportedById: actor.userId ?? null,
        guestId: actor.userId ? null : actor.guestId,
      },
    });
    return { id: row.id.toString() };
  }
}
