import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Actor, AuthUser } from '../auth/auth.types.js';
import {
  CurrentActor,
  CurrentUser,
  GUEST_ID_HEADER,
  Public,
} from '../auth/decorators.js';
import { OptionalJwtAuthGuard } from '../auth/guards.js';
import { MAX_IMAGE_BYTES } from '../storage/storage.service.js';
import {
  AccessKeyDto,
  AccessKeyInfoDto,
  QrReceiptDto,
  ReceiptResultDto,
} from './receipts.dto.js';
import { ReceiptsService } from './receipts.service.js';

/** Receipt uploads are the tightest public limit (spec section 8). */
const RECEIPT_THROTTLE = {
  ip: { limit: 30, ttl: 60_000 },
  default: { limit: 10, ttl: 60_000 },
};

/**
 * NFC-e import. Open to guests (X-Guest-Id) and signed-in users. Every
 * matched line becomes a price (source NFCE) for everyone.
 */
@ApiTags('receipts')
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(RECEIPT_THROTTLE)
  @Post('qr')
  @ApiHeader({
    name: GUEST_ID_HEADER,
    required: false,
    description: 'Device id of guests (UUID v4)',
  })
  @ApiCreatedResponse({ type: ReceiptResultDto })
  @ApiConflictResponse({ description: 'RECEIPT_ALREADY_SENT' })
  @ApiUnprocessableEntityResponse({
    description:
      'NOT_A_RECEIPT_QR, UF_NOT_SUPPORTED, RECEIPT_UNREADABLE, STORE_NOT_LOCATED',
  })
  @ApiServiceUnavailableResponse({ description: 'SEFAZ_UNAVAILABLE' })
  fromQr(
    @Body() dto: QrReceiptDto,
    @CurrentActor() actor: Actor,
  ): Promise<ReceiptResultDto> {
    return this.receipts.importFromQr(dto.url, actor);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(RECEIPT_THROTTLE)
  @Post('photo')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiHeader({ name: GUEST_ID_HEADER, required: false })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: ReceiptResultDto })
  @ApiUnprocessableEntityResponse({
    description: 'PHOTO_UNREADABLE, PHOTO_KEY_UNREADABLE, STORE_NOT_LOCATED',
  })
  @ApiServiceUnavailableResponse({
    description:
      'PHOTO_UNAVAILABLE (no Gemini key) or PHOTO_SERVICE_UNAVAILABLE',
  })
  fromPhoto(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentActor() actor: Actor,
  ): Promise<ReceiptResultDto> {
    return this.receipts.importFromPhoto(file, actor);
  }

  /** Validates a typed 44-digit key (check digit, state, model) and says if it was sent. */
  @Public()
  @Throttle(RECEIPT_THROTTLE)
  @Post('key')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AccessKeyInfoDto })
  keyInfo(@Body() dto: AccessKeyDto): Promise<AccessKeyInfoDto> {
    return this.receipts.keyInfo(dto.accessKey);
  }

  @Get('mine')
  @ApiCookieAuth()
  @ApiOkResponse({ type: [ReceiptResultDto] })
  mine(@CurrentUser() user: AuthUser): Promise<ReceiptResultDto[]> {
    return this.receipts.mine(user.id);
  }
}
