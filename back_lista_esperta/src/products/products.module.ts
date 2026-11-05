import { Module } from '@nestjs/common';
import {
  PRODUCT_LOOKUP,
  OpenFoodFactsLookup,
} from '../integrations/off/open-food-facts.provider.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  controllers: [ProductsController],
  providers: [
    ProductsService,
    { provide: PRODUCT_LOOKUP, useClass: OpenFoodFactsLookup },
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
