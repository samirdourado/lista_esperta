import { formatCnpj, isValidCnpj, normalizeCnpj } from './cnpj.js';
import { CELL_DEGREES, cellFromKey, cellsForCircle } from './geo-cell.js';
import { nameSimilarity, normalizeText } from './text.js';

describe('CNPJ', () => {
  it('accepts valid numbers with or without punctuation', () => {
    expect(isValidCnpj('00.000.000/0001-91')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('rejects wrong check digits, wrong length and repeated digits', () => {
    expect(isValidCnpj('11222333000182')).toBe(false);
    expect(isValidCnpj('1122233300018')).toBe(false);
    expect(isValidCnpj('11111111111111')).toBe(false);
  });

  it('normalizes and formats', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181');
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
});

describe('text helpers', () => {
  it('normalizes accents, case and punctuation', () => {
    expect(normalizeText('  São Paulo - SP ')).toBe('sao paulo sp');
  });

  it('compares business names ignoring legal suffixes', () => {
    expect(
      nameSimilarity('Mercado Bom Preço', 'BOM PRECO SUPERMERCADOS LTDA'),
    ).toBeGreaterThanOrEqual(0.5);
    expect(nameSimilarity('Drogasil', 'RAIA DROGASIL S/A')).toBe(1);
    expect(nameSimilarity('Padaria Central', 'Pet Shop Amigo')).toBe(0);
    expect(nameSimilarity('', 'Qualquer')).toBe(0);
    // Regression: sharing only the kind of shop is not the same shop.
    expect(
      nameSimilarity(
        'Pastorinho Supermercados',
        'BOM PRECO SUPERMERCADOS LTDA',
      ),
    ).toBe(0);
    expect(nameSimilarity('Drogaria São Paulo', 'Drogaria Onofre')).toBe(0);
  });
});

describe('discovery cells', () => {
  it('covers a 5 km circle with a small grid, closest cell first', () => {
    const cells = cellsForCircle(-23.5891, -46.6346, 5);
    expect(cells.length).toBeGreaterThanOrEqual(4);
    expect(cells.length).toBeLessThanOrEqual(16);
    const first = cells[0];
    expect(-23.5891).toBeGreaterThanOrEqual(first.south);
    expect(-23.5891).toBeLessThan(first.north);
    expect(-46.6346).toBeGreaterThanOrEqual(first.west);
    expect(-46.6346).toBeLessThan(first.east);
  });

  it('round-trips cell keys', () => {
    const cell = cellsForCircle(-23.5, -46.6, 1)[0];
    expect(cellFromKey(cell.key)).toEqual(cell);
    expect(cell.north - cell.south).toBeCloseTo(CELL_DEGREES, 6);
  });
});
