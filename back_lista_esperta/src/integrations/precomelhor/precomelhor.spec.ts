import {
  type DirectoryProduct,
  parseCoords,
  pickCandidates,
  plausiblePrices,
} from './precomelhor.service.js';

const product = (name: string, storeCount = 10): DirectoryProduct => ({
  ean: name,
  name,
  imageUrl: null,
  storeCount,
});
const names = (found: DirectoryProduct[]) => found.map((p) => p.name);

describe('pickCandidates', () => {
  it('never turns a generic word into another kind of product', () => {
    const found = pickCandidates(
      'leite integral',
      [
        product('Leite Condensado Moça Integral 395g', 4000),
        product('Biscoito Integral Leite 25g', 900),
        product('Leite em Pó Integral Ninho 800g', 500),
        product('Leite UHT Integral Italac 1L', 200),
      ],
      3,
    );
    expect(names(found)).toEqual(['Leite UHT Integral Italac 1L']);
  });

  it('respects the size typed and ignores accents', () => {
    const found = pickCandidates(
      'cafe 500g',
      [product('Café Pilão 250g'), product('Café Pilão 500g')],
      3,
    );
    expect(names(found)).toEqual(['Café Pilão 500g']);
  });
});

describe('plausiblePrices', () => {
  const here = { lat: -23.58, lng: -46.63 };
  it('drops data errors far from the median of the region', () => {
    const rows = [0.89, 19, 20.5, 21, 59.9].map((price) => ({
      price,
      ...here,
    }));
    expect(plausiblePrices(rows, here).map((r) => r.price)).toEqual([
      19, 20.5, 21,
    ]);
  });

  it('ignores prices from other regions when judging', () => {
    const far = { lat: -27.1, lng: -52.6 };
    const rows = [
      ...[0.47, 1.6, 5.99, 5.99].map((price) => ({ price, ...far })),
      ...[19.9, 20.99, 21.5].map((price) => ({ price, ...here })),
    ];
    expect(
      plausiblePrices(rows, here).filter((r) => r.lat === here.lat),
    ).toHaveLength(3);
  });
});

describe('parseCoords', () => {
  it('reads both formats and refuses non-points', () => {
    expect(parseCoords('-2.505377, -44.245200')).toEqual({
      lat: -2.505377,
      lng: -44.2452,
    });
    expect(parseCoords('')).toBeNull();
    expect(parseCoords('0,0')).toBeNull();
  });
});
