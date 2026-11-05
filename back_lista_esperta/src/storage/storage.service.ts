import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';

/** Where uploaded files live. Local disk today; swap for a bucket later. */
export abstract class StorageService {
  abstract save(
    folder: string,
    data: Buffer,
    extension: string,
  ): Promise<string>;
  abstract remove(key: string): Promise<void>;
  abstract publicUrl(key: string): string;
}

export const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;
export type ImageType = keyof typeof IMAGE_TYPES;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Checks the file's first bytes, not the name or the header the client sent. */
export function sniffImage(data: Buffer): ImageType | null {
  if (data.length < 12) return null;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    return 'image/jpeg';
  if (
    data
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    data.subarray(0, 4).toString('ascii') === 'RIFF' &&
    data.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** Validates an uploaded image and returns its extension. */
export function assertImage(
  file: { buffer: Buffer; size: number } | undefined,
): string {
  if (!file) throw new BadRequestException('Send an image in the "file" field');
  if (file.size > MAX_IMAGE_BYTES)
    throw new BadRequestException('Images must be up to 5 MB');
  const type = sniffImage(file.buffer);
  if (!type) throw new BadRequestException('Use a JPEG, PNG or WebP image');
  return IMAGE_TYPES[type];
}

@Injectable()
export class LocalStorageService extends StorageService {
  private readonly root: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    super();
    this.root = resolve(config.get('UPLOADS_DIR', { infer: true }));
  }

  get rootDir(): string {
    return this.root;
  }

  async save(folder: string, data: Buffer, extension: string): Promise<string> {
    const key = `${folder.replace(/[^a-z0-9/-]/gi, '')}/${randomUUID()}.${extension}`;
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
    return key;
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  publicUrl(key: string): string {
    return `${this.config.get('PUBLIC_URL', { infer: true })}/uploads/${key}`;
  }

  /** Keeps every key inside the uploads folder (no "../"). */
  private pathOf(key: string): string {
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root + sep))
      throw new BadRequestException('Invalid file key');
    return path;
  }
}
