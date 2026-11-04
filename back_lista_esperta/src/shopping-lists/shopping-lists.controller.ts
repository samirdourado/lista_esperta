import {
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
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import {
  ImportShoppingListsDto,
  ImportShoppingListsResponseDto,
  ShoppingListResponseDto,
  UpsertShoppingListDto,
} from './shopping-lists.dto.js';
import { ShoppingListsService } from './shopping-lists.service.js';

/** Server-side lists of signed-in shoppers. Guests keep lists on the device. */
@ApiTags('shopping-lists')
@ApiCookieAuth()
@Controller('shopping-lists')
export class ShoppingListsController {
  constructor(private readonly lists: ShoppingListsService) {}

  @Get()
  @ApiOkResponse({ type: [ShoppingListResponseDto] })
  findAll(@CurrentUser() user: AuthUser): Promise<ShoppingListResponseDto[]> {
    return this.lists.findAll(user.id);
  }

  /** Moves the device's lists (and guest receipts/prices) into the account. */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ImportShoppingListsResponseDto })
  importFromDevice(
    @CurrentUser() user: AuthUser,
    @Body() dto: ImportShoppingListsDto,
  ): Promise<ImportShoppingListsResponseDto> {
    return this.lists.importFromDevice(user.id, dto);
  }

  @Post()
  @ApiCreatedResponse({ type: ShoppingListResponseDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertShoppingListDto,
  ): Promise<ShoppingListResponseDto> {
    return this.lists.create(user.id, dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: ShoppingListResponseDto })
  @ApiNotFoundResponse()
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ShoppingListResponseDto> {
    return this.lists.findOne(user.id, id);
  }

  @Put(':id')
  @ApiOkResponse({ type: ShoppingListResponseDto })
  @ApiNotFoundResponse()
  replace(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertShoppingListDto,
  ): Promise<ShoppingListResponseDto> {
    return this.lists.replace(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.lists.remove(user.id, id);
  }
}
