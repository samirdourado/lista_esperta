import { Module } from '@nestjs/common';
import { GeocodingController } from './geocoding.controller.js';

@Module({ controllers: [GeocodingController] })
export class GeocodingModule {}
