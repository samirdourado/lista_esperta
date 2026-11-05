import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public, Roles } from '../auth/decorators.js';
import {
  CategoryNodeDto,
  CreateProductDto,
  ProductLookupResponseDto,
  ProductResponseDto,
  ProductSearchQueryDto,
} from './products.dto.js';
import { ProductsService } from './products.service.js';

@ApiTags('products')
@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** Catalog search for list autocomplete and merchants. No account needed. */
  @Public()
  @Get('products')
  @ApiOkResponse({ type: [ProductResponseDto] })
  search(@Query() query: ProductSearchQueryDto): Promise<ProductResponseDto[]> {
    return this.products.search(query);
  }

  @Get('products/lookup/:gtin')
  @Roles('MERCHANT', 'ADMIN')
  @ApiCookieAuth()
  @ApiOkResponse({ type: ProductLookupResponseDto })
  lookup(@Param('gtin') gtin: string): Promise<ProductLookupResponseDto> {
    return this.products.lookupGtin(gtin.replace(/\D/g, ''));
  }

  @Post('products')
  @Roles('MERCHANT', 'ADMIN')
  @ApiCookieAuth()
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiConflictResponse({ description: 'GTIN_TAKEN' })
  create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    return this.products.create(dto);
  }

  @Public()
  @Get('categories')
  @ApiOkResponse({ type: [CategoryNodeDto] })
  categories(): Promise<CategoryNodeDto[]> {
    return this.products.categoryTree();
  }
}
