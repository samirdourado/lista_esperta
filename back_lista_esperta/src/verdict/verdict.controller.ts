import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { Actor } from '../auth/auth.types.js';
import { CurrentActor, GUEST_ID_HEADER, Public } from '../auth/decorators.js';
import { OptionalJwtAuthGuard } from '../auth/guards.js';
import { ExternalServiceError } from '../integrations/http.js';
import {
  AiOutputError,
  LIST_READER,
  type ListReader,
} from '../integrations/gemini/gemini.service.js';
import { assertImage, MAX_IMAGE_BYTES } from '../storage/storage.service.js';
import {
  ParsedListLineDto,
  VerdictRequestDto,
  VerdictResponseDto,
} from './verdict.dto.js';
import { VerdictService } from './verdict.service.js';

@ApiTags('verdict')
@Controller()
export class VerdictController {
  constructor(
    private readonly verdict: VerdictService,
    @Inject(LIST_READER) private readonly lists: ListReader,
  ) {}

  /**
   * "Onde a minha lista inteira sai mais barata, perto de mim, hoje?"
   * Stateless and open to everyone: items + location + preferences in, ranking out.
   */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('verdict')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: GUEST_ID_HEADER, required: false })
  @ApiOkResponse({ type: VerdictResponseDto })
  compute(
    @Body() dto: VerdictRequestDto,
    @CurrentActor() actor: Actor,
    @Req() req: Request,
  ): Promise<VerdictResponseDto> {
    return this.verdict.compute(
      dto,
      actor.userId ?? actor.guestId ?? req.ip ?? 'anonymous',
    );
  }

  /** Photo of a handwritten list → lines to review before comparing. */
  @Public()
  @Throttle({
    ip: { limit: 30, ttl: 60_000 },
    default: { limit: 10, ttl: 60_000 },
  })
  @Post('lists/parse-photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: [ParsedListLineDto] })
  @ApiServiceUnavailableResponse({
    description: 'PHOTO_UNAVAILABLE / PHOTO_SERVICE_UNAVAILABLE',
  })
  async parsePhoto(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ParsedListLineDto[]> {
    assertImage(file);
    if (!this.lists.enabled) {
      throw new ServiceUnavailableException({
        code: 'PHOTO_UNAVAILABLE',
        message: 'Photo reading is not configured',
      });
    }
    try {
      return (await this.lists.readList(file!.buffer, file!.mimetype)).lines;
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw new ServiceUnavailableException({
          code: 'PHOTO_SERVICE_UNAVAILABLE',
          message: 'Photo reading did not answer',
        });
      }
      if (error instanceof AiOutputError) {
        throw new UnprocessableEntityException({
          code: 'PHOTO_UNREADABLE',
          message: 'Could not read this photo',
        });
      }
      throw error;
    }
  }
}
