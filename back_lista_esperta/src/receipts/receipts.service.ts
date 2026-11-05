import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Actor } from '../auth/auth.types.js';
import { nameSimilarity } from '../common/text.js';
import { Prisma } from '../generated/prisma/client.js';
import { ExternalServiceError } from '../integrations/http.js';
import {
  AiOutputError,
  RECEIPT_READER,
  type ReceiptReader,
} from '../integrations/gemini/gemini.service.js';
import {
  GEOCODING_PROVIDER,
  type GeocodingProvider,
} from '../integrations/providers.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertImage, StorageService } from '../storage/storage.service.js';
import { StoresGeoRepository } from '../stores/stores-geo.repository.js';
import { accessKeyFromQrUrl, parseAccessKey } from './access-key.js';
import { NormalizationService } from './normalization.service.js';
import { parserForUf } from './parsers/index.js';
import { ReceiptParseError } from './parsers/nfce-parser.js';
import type { ParsedReceipt } from './receipt.types.js';
import type { AccessKeyInfoDto, ReceiptResultDto } from './receipts.dto.js';
import { splitSpAddress } from './parsers/sp.parser.js';
import { SEFAZ_FETCHER, type SefazFetcher } from './sefaz-fetcher.js';

/** A receipt store this close to a known store with a similar name is the same store. */
const SAME_STORE_RADIUS_KM = 0.15;

const unprocessable = (code: string, message: string) =>
  new UnprocessableEntityException({ code, message });

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: StoresGeoRepository,
    private readonly normalization: NormalizationService,
    private readonly storage: StorageService,
    @Inject(GEOCODING_PROVIDER) private readonly geocoding: GeocodingProvider,
    @Inject(RECEIPT_READER) private readonly reader: ReceiptReader,
    @Inject(SEFAZ_FETCHER) private readonly sefaz: SefazFetcher,
  ) {}

  /** Checks a typed key without reading the receipt (the key alone needs a captcha). */
  async keyInfo(raw: string): Promise<AccessKeyInfoDto> {
    const parsed = parseAccessKey(raw);
    if (!parsed.ok) {
      return {
        valid: false,
        uf: null,
        cnpj: null,
        month: null,
        supported: false,
        alreadySent: false,
        error: parsed.error,
      };
    }
    const { value } = parsed;
    return {
      valid: true,
      uf: value.uf,
      cnpj: value.cnpj,
      month: `${value.year}-${String(value.month).padStart(2, '0')}`,
      supported: Boolean(parserForUf(value.uf)),
      alreadySent: Boolean(
        await this.prisma.receipt.findUnique({
          where: { accessKey: value.key },
          select: { id: true },
        }),
      ),
      error: null,
    };
  }

  /** QR code: the URL is fetched from the state SEFAZ (allow-listed hosts only). */
  async importFromQr(rawUrl: string, actor: Actor): Promise<ReceiptResultDto> {
    let url: URL;
    try {
      url = new URL(rawUrl.trim());
    } catch {
      throw unprocessable(
        'NOT_A_RECEIPT_QR',
        'This QR code is not an NFC-e link',
      );
    }
    const key = accessKeyFromQrUrl(url);
    const parsed = key ? parseAccessKey(key) : null;
    if (!parsed?.ok)
      throw unprocessable(
        'NOT_A_RECEIPT_QR',
        'This QR code is not an NFC-e link',
      );
    const parser = parserForUf(parsed.value.uf);
    if (!parser)
      throw unprocessable(
        'UF_NOT_SUPPORTED',
        `Receipts from ${parsed.value.uf} are not supported yet`,
      );
    if (url.protocol !== 'https:' || !parser.hosts.includes(url.hostname)) {
      throw unprocessable(
        'NOT_A_RECEIPT_QR',
        'This QR code does not point to the SEFAZ',
      );
    }
    await this.assertNew(parsed.value.key);

    const html = await this.fetchPage(url);
    let receipt: ParsedReceipt;
    try {
      receipt = parser.parse(html, parsed.value.key);
    } catch (error) {
      if (error instanceof ReceiptParseError) {
        this.logger.warn(`SEFAZ page could not be parsed: ${error.message}`);
        throw unprocessable(
          'RECEIPT_UNREADABLE',
          'The SEFAZ page did not show this receipt; try the photo',
        );
      }
      throw error;
    }
    if (receipt.issuer.cnpj && receipt.issuer.cnpj !== parsed.value.cnpj) {
      throw unprocessable(
        'RECEIPT_MISMATCH',
        'The page does not match the receipt key',
      );
    }
    receipt.issuer.cnpj ||= parsed.value.cnpj;
    return this.persist(receipt, actor, null);
  }

  /** Photo without a readable QR: Gemini reads it; the access key is still required. */
  async importFromPhoto(
    file: Express.Multer.File | undefined,
    actor: Actor,
  ): Promise<ReceiptResultDto> {
    const extension = assertImage(file);
    if (!this.reader.enabled) {
      throw new ServiceUnavailableException({
        code: 'PHOTO_UNAVAILABLE',
        message: 'Photo reading is not configured',
      });
    }
    let extracted;
    try {
      extracted = await this.reader.read(file!.buffer, file!.mimetype);
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw new ServiceUnavailableException({
          code: 'PHOTO_SERVICE_UNAVAILABLE',
          message: 'Photo reading did not answer',
        });
      }
      if (error instanceof AiOutputError)
        throw unprocessable('PHOTO_UNREADABLE', 'Could not read this photo');
      throw error;
    }
    // The key makes the receipt auditable and unique: without it the photo is not accepted.
    const key = parseAccessKey(extracted.access_key ?? '');
    if (!key.ok)
      throw unprocessable(
        'PHOTO_KEY_UNREADABLE',
        'The 44-digit access key is not readable in the photo',
      );
    await this.assertNew(key.value.key);
    const issuedAt = new Date(extracted.issued_at);
    if (Number.isNaN(issuedAt.getTime()) || extracted.lines.length === 0) {
      throw unprocessable('PHOTO_UNREADABLE', 'Could not read this photo');
    }

    const photoKey = await this.storage.save(
      'receipts',
      file!.buffer,
      extension,
    );
    const addressText = extracted.address ?? '';
    return this.persist(
      {
        accessKey: key.value.key,
        issuer: {
          name: extracted.store_name,
          cnpj: (extracted.cnpj ?? '').replace(/\D/g, '') || key.value.cnpj,
          address: splitSpAddress(addressText),
          addressText,
        },
        issuedAt,
        total: extracted.total,
        lines: extracted.lines.map((line) => ({
          description: line.description,
          code: line.code?.replace(/\D/g, '') || null,
          quantity: line.quantity,
          unit: line.unit.toUpperCase(),
          unitPrice: line.unit_price,
          totalPrice: line.total_price,
        })),
        source: 'PHOTO',
      },
      actor,
      photoKey,
    );
  }

  async mine(userId: string): Promise<ReceiptResultDto[]> {
    const receipts = await this.prisma.receipt.findMany({
      where: { uploadedById: userId },
      orderBy: { issuedAt: 'desc' },
      take: 50,
      include: {
        store: { select: { id: true, name: true } },
        _count: { select: { prices: true } },
      },
    });
    return receipts.map((receipt) => {
      const raw = receipt.raw as {
        source?: 'SEFAZ' | 'PHOTO';
        lines?: ReceiptResultDto['lines'];
      };
      return {
        id: receipt.id,
        accessKey: receipt.accessKey,
        store: receipt.store,
        issuedAt: receipt.issuedAt.toISOString(),
        total: receipt.total.toNumber(),
        pricesAdded: receipt._count.prices,
        source: raw.source ?? 'SEFAZ',
        lines: raw.lines ?? [],
      };
    });
  }

  private async assertNew(accessKey: string): Promise<void> {
    if (
      await this.prisma.receipt.findUnique({
        where: { accessKey },
        select: { id: true },
      })
    ) {
      throw new ConflictException({
        code: 'RECEIPT_ALREADY_SENT',
        message: 'This receipt was already sent',
      });
    }
  }

  private async fetchPage(url: URL): Promise<string> {
    try {
      return await this.sefaz.fetchPage(url);
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw new ServiceUnavailableException({
          code: 'SEFAZ_UNAVAILABLE',
          message: 'The SEFAZ did not answer; try again later',
        });
      }
      throw error;
    }
  }

  /** The issuer's CNPJ identifies the store; a new one is created (source NFCE) when unknown. */
  private async storeFor(
    receipt: ParsedReceipt,
  ): Promise<{ id: string; name: string }> {
    const known = await this.prisma.store.findUnique({
      where: { cnpj: receipt.issuer.cnpj },
      select: { id: true, name: true },
    });
    if (known) return known;

    const { address } = receipt.issuer;
    const query = [
      address.street,
      address.number,
      address.district,
      address.city,
      address.state,
    ]
      .filter(Boolean)
      .join(', ');
    let place;
    try {
      [place] = query ? await this.geocoding.search(query) : [];
      if (!place && address.city)
        [place] = await this.geocoding.search(
          [address.city, address.state].filter(Boolean).join(', '),
        );
    } catch (error) {
      if (!(error instanceof ExternalServiceError)) throw error;
    }
    if (!place)
      throw unprocessable(
        'STORE_NOT_LOCATED',
        'Could not find the store address on the map',
      );

    // Same shop already on the map (e.g. from OpenStreetMap)? Give it the CNPJ.
    const nearby = await this.geo.findClaimable(
      place.lat,
      place.lng,
      receipt.issuer.name,
      SAME_STORE_RADIUS_KM,
    );
    const twin = nearby
      .filter((store) => !store.cnpj)
      .map((store) => ({
        store,
        score: nameSimilarity(store.name, receipt.issuer.name),
      }))
      .sort((a, b) => b.score - a.score)[0];
    if (twin && twin.score >= 0.5) {
      await this.prisma.store.update({
        where: { id: twin.store.id },
        data: { cnpj: receipt.issuer.cnpj },
      });
      return { id: twin.store.id, name: twin.store.name };
    }
    const id = await this.geo.create({
      name: receipt.issuer.name,
      cnpj: receipt.issuer.cnpj,
      source: 'NFCE',
      lat: place.lat,
      lng: place.lng,
      address: {
        ...address,
        ...Object.fromEntries(
          Object.entries(place.address).filter(([, v]) => v),
        ),
      },
    });
    return { id, name: receipt.issuer.name };
  }

  private async persist(
    receipt: ParsedReceipt,
    actor: Actor,
    photoKey: string | null,
  ): Promise<ReceiptResultDto> {
    const store = await this.storeFor(receipt);
    const matches = await this.normalization.match(receipt.lines, store.id);
    const lines = receipt.lines.map((line, index) => ({
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      totalPrice: line.totalPrice,
      status: matches[index].status,
      productName: matches[index].productName,
    }));

    try {
      const saved = await this.prisma.$transaction(async (tx) => {
        const row = await tx.receipt.create({
          data: {
            accessKey: receipt.accessKey,
            storeId: store.id,
            issuedAt: receipt.issuedAt,
            total: receipt.total,
            uploadedById: actor.userId ?? null,
            guestId: actor.userId ? null : (actor.guestId ?? null),
            raw: {
              source: receipt.source,
              issuer: {
                ...receipt.issuer,
                address: { ...receipt.issuer.address },
              },
              photoKey,
              // Kept for the admin: pending aliases are priced from here once approved.
              lines: lines.map((line, index) => ({
                ...line,
                code: receipt.lines[index].code,
                aliasId: matches[index].aliasId,
                productId: matches[index].productId,
                via: matches[index].via,
              })),
            },
          },
        });
        const priced = receipt.lines.flatMap((line, index) =>
          matches[index].status === 'MATCHED' &&
          matches[index].productId &&
          line.unitPrice > 0
            ? [{ productId: matches[index].productId, price: line.unitPrice }]
            : [],
        );
        if (priced.length > 0) {
          await tx.priceObservation.createMany({
            data: priced.map((entry) => ({
              productId: entry.productId,
              storeId: store.id,
              price: entry.price,
              source: 'NFCE' as const,
              observedAt: receipt.issuedAt,
              receiptId: row.id,
              reportedById: actor.userId ?? null,
              guestId: actor.userId ? null : (actor.guestId ?? null),
            })),
          });
        }
        return { row, pricesAdded: priced.length };
      });
      return {
        id: saved.row.id,
        accessKey: receipt.accessKey,
        store,
        issuedAt: receipt.issuedAt.toISOString(),
        total: receipt.total,
        pricesAdded: saved.pricesAdded,
        source: receipt.source,
        lines,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'RECEIPT_ALREADY_SENT',
          message: 'This receipt was already sent',
        });
      }
      throw error;
    }
  }

  /** Used by tests and the admin: a receipt with its store. */
  async get(id: string) {
    const receipt = await this.prisma.receipt.findUnique({ where: { id } });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return receipt;
  }
}
