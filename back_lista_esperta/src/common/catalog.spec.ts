import {
  categoryFromTags,
  toProductSuggestion,
} from '../integrations/off/open-food-facts.provider.js';
import { parseCsv, parseDay, parsePrice } from './csv.js';
import { isValidGtin } from './gtin.js';

describe('CSV', () => {
  it('reads Excel pt-BR files with ";", quotes and CRLF', () => {
    const csv =
      '﻿gtin;nome;preco\r\n7891000100103;"Leite ""Moça"" 395 g";12,90\r\n\r\n;Banana;6,99\r\n';
    expect(parseCsv(csv)).toEqual([
      ['gtin', 'nome', 'preco'],
      ['7891000100103', 'Leite "Moça" 395 g', '12,90'],
      ['', 'Banana', '6,99'],
    ]);
  });

  it('reads comma files with quoted commas', () => {
    expect(parseCsv('name,price\n"Arroz, 5 kg",27.90')).toEqual([
      ['name', 'price'],
      ['Arroz, 5 kg', '27.90'],
    ]);
  });

  it('parses Brazilian and international prices', () => {
    expect(parsePrice('12,90')).toBe(12.9);
    expect(parsePrice('R$ 1.234,56')).toBe(1234.56);
    expect(parsePrice('1,234.56')).toBe(1234.56);
    expect(parsePrice('0')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
  });

  it('parses dates as the end of the day in São Paulo', () => {
    expect(parseDay('31/12/2026')?.toISOString()).toBe(
      '2027-01-01T02:59:59.000Z',
    );
    expect(parseDay('2026-12-31')?.toISOString()).toBe(
      '2027-01-01T02:59:59.000Z',
    );
    expect(parseDay('amanhã')).toBeNull();
  });
});

describe('GTIN', () => {
  it('checks the GS1 digit', () => {
    expect(isValidGtin('7891000100103')).toBe(true);
    expect(isValidGtin('7891000100104')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true);
    expect(isValidGtin('123')).toBe(false);
  });
});

describe('Open Food Facts mapping', () => {
  it('turns a product into a suggestion with unit and category', () => {
    expect(
      toProductSuggestion('7894900011517', {
        product_name_pt: 'Refrigerante Coca-Cola 2Lt',
        brands: 'Coca-Cola, The Coca-Cola Company',
        product_quantity: 2000,
        product_quantity_unit: 'ml',
        categories_tags: ['pt:Bebida'],
      }),
    ).toEqual({
      gtin: '7894900011517',
      name: 'Refrigerante Coca-Cola 2Lt',
      brand: 'Coca-Cola',
      unit: 'ML',
      unitQuantity: 2000,
      categorySlug: 'bebidas',
      source: 'OPEN_FOOD_FACTS',
    });
  });

  it('maps category tags and leaves unknown units empty', () => {
    expect(categoryFromTags(['en:dairies', 'en:condensed-milks'])).toBe(
      'laticinios',
    );
    expect(categoryFromTags([])).toBeNull();
    expect(
      toProductSuggestion('1', {
        product_name: 'X',
        product_quantity: 3,
        product_quantity_unit: 'pack',
      }),
    ).toMatchObject({ unit: null, unitQuantity: null });
    expect(toProductSuggestion('1', { brands: 'Sem nome' })).toBeNull();
  });
});
