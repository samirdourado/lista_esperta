import { Module } from '@nestjs/common';
import { StoresModule } from '../stores/stores.module.js';
import { VerdictModule } from '../verdict/verdict.module.js';
import { AlertsController } from './alerts.controller.js';
import { AlertsService } from './alerts.service.js';
import { PUSH_SENDER, WebPushSender } from './push.service.js';

@Module({
  imports: [StoresModule, VerdictModule],
  controllers: [AlertsController],
  providers: [AlertsService, { provide: PUSH_SENDER, useClass: WebPushSender }],
})
export class AlertsModule {}
