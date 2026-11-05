import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import type { Env } from '../config/env.schema.js';

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Page opened when the notification is tapped. */
  url: string;
  tag?: string;
}

/** "gone": the browser dropped the subscription, so we delete it. */
export type PushResult = 'sent' | 'gone' | 'failed';

/** Sends Web Push notifications with our own VAPID keys (no third-party account). */
export interface PushSender {
  readonly enabled: boolean;
  readonly publicKey: string | null;
  send(target: PushTarget, message: PushMessage): Promise<PushResult>;
}
export const PUSH_SENDER = Symbol('PUSH_SENDER');

@Injectable()
export class WebPushSender implements PushSender {
  private readonly logger = new Logger(WebPushSender.name);
  readonly publicKey: string | null;
  private readonly privateKey: string | null;
  private readonly subject: string;

  constructor(config: ConfigService<Env, true>) {
    this.publicKey = config.get('VAPID_PUBLIC_KEY', { infer: true }) || null;
    this.privateKey = config.get('VAPID_PRIVATE_KEY', { infer: true }) || null;
    this.subject = config.get('VAPID_SUBJECT', { infer: true });
  }

  get enabled(): boolean {
    return Boolean(this.publicKey && this.privateKey);
  }

  async send(target: PushTarget, message: PushMessage): Promise<PushResult> {
    if (!this.publicKey || !this.privateKey) return 'failed';
    try {
      await webpush.sendNotification(
        {
          endpoint: target.endpoint,
          keys: { p256dh: target.p256dh, auth: target.auth },
        },
        JSON.stringify(message),
        {
          vapidDetails: {
            subject: this.subject,
            publicKey: this.publicKey,
            privateKey: this.privateKey,
          },
          TTL: 24 * 3600,
          timeout: 10_000,
        },
      );
      return 'sent';
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'gone';
      this.logger.warn(`Push failed (HTTP ${status ?? 'network'})`);
      return 'failed';
    }
  }
}
