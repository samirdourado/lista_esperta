import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { StoreMemberGuard } from '../stores/store-member.guard.js';
import {
  CatalogItemDto,
  CatalogQueryDto,
  IMPORT_MAX_BYTES,
  ImportReportDto,
  SetPricesDto,
  StoreOverviewDto,
} from './prices.dto.js';
import { PricesService } from './prices.service.js';

class SavedDto {
  @ApiProperty() saved: number;
}

/** The merchant's catalog and prices for one store. Members only. */
@ApiTags('store prices')
@ApiCookieAuth()
@Roles('MERCHANT', 'ADMIN')
@UseGuards(StoreMemberGuard)
@Controller('stores/:storeId')
export class PricesController {
  constructor(private readonly prices: PricesService) {}

  @Get('overview')
  @ApiOkResponse({ type: StoreOverviewDto })
  overview(
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ): Promise<StoreOverviewDto> {
    return this.prices.overview(storeId);
  }

  @Get('products')
  @ApiOkResponse({ type: [CatalogItemDto] })
  catalog(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: CatalogQueryDto,
  ): Promise<CatalogItemDto[]> {
    return this.prices.catalog(storeId, query.q);
  }

  /** Sets prices in bulk (regular, or offers with validUntil). */
  @Put('prices')
  @ApiOkResponse({ type: SavedDto })
  async setPrices(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetPricesDto,
  ): Promise<SavedDto> {
    return { saved: await this.prices.setPrices(storeId, user.id, dto.prices) };
  }

  @Delete('products/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  withdraw(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    return this.prices.withdrawProduct(storeId, productId);
  }

  @Delete('offers/:offerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  endOffer(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('offerId') offerId: string,
  ): Promise<void> {
    return this.prices.endOffer(storeId, offerId);
  }

  /** CSV with barcode or name, price and optional offer end date. Up to 2,000 rows. */
  @Post('prices/import')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: IMPORT_MAX_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: ImportReportDto })
  importCsv(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ImportReportDto> {
    if (!file)
      throw new BadRequestException('Send the spreadsheet in the "file" field');
    const text = file.buffer.toString('utf8');
    if (text.includes('\u0000')) {
      throw new BadRequestException({
        code: 'NOT_CSV',
        message: 'Save the spreadsheet as CSV',
      });
    }
    return this.prices.importCsv(storeId, user.id, text);
  }
}
