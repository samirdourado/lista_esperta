import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ACCESS_COOKIE } from './auth/auth.cookies.js';
import { GUEST_ID_HEADER } from './auth/decorators.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Env } from './config/env.schema.js';
import { LocalStorageService } from './storage/storage.service.js';

export const API_PREFIX = 'api/v1';

/** Shared by main.ts and the e2e tests so both run the same pipeline. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix(API_PREFIX);
  // Uploaded images (store photos, receipt photos). Names are random UUIDs.
  (app as NestExpressApplication).useStaticAssets(
    app.get(LocalStorageService).rootDir,
    {
      prefix: '/uploads/',
      index: false,
      dotfiles: 'deny',
      maxAge: '7d',
      setHeaders: (res: { setHeader(name: string, value: string): unknown }) =>
        res.setHeader('X-Content-Type-Options', 'nosniff'),
    },
  );
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: config.get('FRONTEND_URL', { infer: true }),
    credentials: true,
    allowedHeaders: ['Content-Type', GUEST_ID_HEADER],
  });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Lista Esperta API')
      .setVersion('0.1.0')
      .setDescription(
        'Sign in with POST /auth/login: the browser stores the session in httpOnly cookies.',
      )
      .addCookieAuth(ACCESS_COOKIE)
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { withCredentials: true },
  });
}
