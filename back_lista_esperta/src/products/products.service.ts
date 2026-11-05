import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { isValidGtin } from '../common/gtin.js';
import { Prisma } from '../generated/prisma/client.js';
import { ExternalServiceError } from '../integrations/http.js';
import {
  PRODUCT_LOOKUP,
  type ProductLookup,
  type ProductSuggestion,
} from '../integrations/off/open-food-facts.provider.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type CategoryNodeDto,
  type CreateProductDto,
  type ProductLookupResponseDto,
  ProductResponseDto,
} from './products.dto.js';

const withCategory = { category: { select: { slug: true } } } as const;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRODUCT_LOOKUP) private readonly lookup: ProductLookup,
  ) {}

  /** Public catalog search: barcode, or name by trigram similarity. */
  async search(query: {
    q?: string;
    gtin?: string;
    limit: number;
  }): Promise<ProductResponseDto[]> {
    if (query.gtin) {
      const product = await this.prisma.product.findUnique({
        where: { gtin: query.gtin },
        include: withCategory,
      });
      return product ? [ProductResponseDto.from(product)] : [];
    }
    if (!query.q) return [];
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM products
      WHERE canonical_name ILIKE ${`%${query.q}%`} OR similarity(canonical_name, ${query.q}) > 0.25
      ORDER BY similarity(canonical_name, ${query.q}) DESC
      LIMIT ${query.limit}`;
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids.map((row) => row.id) } },
      include: withCategory,
    });
    const order = new Map(ids.map((row, index) => [row.id, index]));
    return products
      .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
      .map((product) => ProductResponseDto.from(product));
  }

  /** Barcode → product in the catalog, or a suggestion from Open Food Facts. */
  async lookupGtin(gtin: string): Promise<ProductLookupResponseDto> {
    if (!isValidGtin(gtin))
      throw new BadRequestException({
        code: 'INVALID_GTIN',
        message: 'Invalid barcode',
      });
    const product = await this.prisma.product.findUnique({
      where: { gtin },
      include: withCategory,
    });
    if (product)
      return { product: ProductResponseDto.from(product), suggestion: null };
    return { product: null, suggestion: await this.suggest(gtin) };
  }

  /** Never fails the caller: the merchant can always fill the form by hand. */
  async suggest(gtin: string): Promise<ProductSuggestion | null> {
    try {
      return await this.lookup.findByGtin(gtin);
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        this.logger.warn(`Open Food Facts lookup failed: ${error.message}`);
        return null;
      }
      throw error;
    }
  }

  async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    if (dto.gtin && !isValidGtin(dto.gtin)) {
      throw new BadRequestException({
        code: 'INVALID_GTIN',
        message: 'Invalid barcode',
      });
    }
    const category = await this.prisma.category.findUnique({
      where: { slug: dto.categorySlug },
    });
    if (!category)
      throw new BadRequestException({
        code: 'UNKNOWN_CATEGORY',
        message: 'Unknown category',
      });
    try {
      const product = await this.prisma.product.create({
        data: {
          gtin: dto.gtin ?? null,
          canonicalName: dto.canonicalName,
          brand: dto.brand ?? null,
          categoryId: category.id,
          unit: dto.unit,
          unitQuantity: dto.unitQuantity,
        },
        include: withCategory,
      });
      return ProductResponseDto.from(product);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.product.findUnique({
          where: { gtin: dto.gtin! },
          select: { id: true },
        });
        throw new ConflictException({
          code: 'GTIN_TAKEN',
          message: 'A product with this barcode exists',
          productId: existing?.id,
        });
      }
      throw error;
    }
  }

  async categoryTree(): Promise<CategoryNodeDto[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    const node = (id: string | null): CategoryNodeDto[] =>
      rows
        .filter((row) => row.parentId === id)
        .map((row) => ({
          slug: row.slug,
          name: row.name,
          children: node(row.id),
        }));
    return node(null);
  }
}
