import {
  computeVerdict,
  type EngineItem,
  type EngineParams,
  type EngineStore,
  median,
} from './engine.js';
import { isOpenAt, parseOsmHours } from './opening-hours.js';

const PARAMS: EngineParams = {
  splitMinSavings: 10,
  splitMinShare: 0.05,
  splitCandidates: 8,
};

const store = (
  id: string,
  km: number,
  prices: Record<string, number>,
): EngineStore => ({
  id,
  km,
  minutes: km * 3,
  prices: new Map(
    Object.entries(prices).map(([product, price]) => [product, { price }]),
  ),
});
const items = (...ids: (string | null)[]): EngineItem[] =>
  ids.map((productId, index) => ({ index, productId, quantity: 1 }));
const straight = () => ({ km: 1, minutes: 3 });

describe('computeVerdict', () => {
  it('ranks by the basket price alone; the trip is only shown', () => {
    const near = store('near', 0.5, { rice: 30, beans: 10 }); // 40
    const far = store('far', 5, { rice: 27, beans: 9 }); // 36
    const { ranking } = computeVerdict(
      items('rice', 'beans'),
      [near, far],
      straight,
      PARAMS,
    );
    expect(ranking.map((r) => [r.storeId, r.totalCost])).toEqual([
      ['far', 36],
      ['near', 40],
    ]);
    expect(ranking[0]).toMatchObject({ found: 2, priced: 2, travelKm: 10 });
  });

  it('breaks a price tie with the closer store', () => {
    const { ranking } = computeVerdict(
      items('rice'),
      [store('far', 3, { rice: 28 }), store('near', 0.5, { rice: 28 })],
      straight,
      PARAMS,
    );
    expect(ranking.map((r) => r.storeId)).toEqual(['near', 'far']);
  });

  it('penalizes missing items with the regional median and reports "X de Y"', () => {
    const a = store('a', 1, { rice: 20, milk: 5 });
    const b = store('b', 1, { rice: 22 });
    const c = store('c', 1, { rice: 24, milk: 7 });
    const result = computeVerdict(
      items('rice', 'milk', 'ghost'),
      [a, b, c],
      straight,
      PARAMS,
    );
    const bTotals = result.ranking.find((r) => r.storeId === 'b')!;
    expect(bTotals).toMatchObject({
      found: 1,
      priced: 2,
      missing: [1],
      missingPenalty: 6,
    }); // median(5, 7) = 6
    expect(result.unpriced).toEqual([2]);
  });

  it('suggests two stores only above R$ 10 and 5 % of savings', () => {
    const meat = store('meat', 1, { steak: 40, soap: 20 });
    const clean = store('clean', 1, { steak: 70, soap: 5 });
    const withSplit = computeVerdict(
      items('steak', 'soap'),
      [meat, clean],
      straight,
      PARAMS,
    );
    // Best single: meat 60. Pair: 40 + 5 = 45 → saves 15 (25 %).
    expect(withSplit.split).toMatchObject({
      savings: 15,
      totalCost: 45,
      travelKm: 3,
    });
    expect(withSplit.split!.assignment).toEqual({ 0: 'meat', 1: 'clean' });

    const small = computeVerdict(
      items('steak', 'soap'),
      [store('meat', 1, { steak: 40, soap: 12 }), clean],
      straight,
      PARAMS,
    );
    expect(small.split).toBeNull(); // saves 7: below R$ 10

    const tunedDown = computeVerdict(
      items('steak', 'soap'),
      [store('meat', 1, { steak: 40, soap: 12 }), clean],
      straight,
      {
        ...PARAMS,
        splitMinSavings: 5,
      },
    );
    expect(tunedDown.split?.savings).toBe(7); // thresholds are configurable
  });

  it('ignores stores that have none of the items and items nobody prices', () => {
    const result = computeVerdict(
      items('rice', null),
      [store('empty', 0.1, {}), store('a', 1, { rice: 10 })],
      straight,
      PARAMS,
    );
    expect(result.ranking.map((r) => r.storeId)).toEqual(['a']);
    expect(result.unpriced).toEqual([1]);
  });

  it('is deterministic for ties', () => {
    const one = computeVerdict(
      items('rice'),
      [store('b', 1, { rice: 10 }), store('a', 1, { rice: 10 })],
      straight,
      PARAMS,
    );
    const two = computeVerdict(
      items('rice'),
      [store('a', 1, { rice: 10 }), store('b', 1, { rice: 10 })],
      straight,
      PARAMS,
    );
    expect(one.ranking).toEqual(two.ranking);
    expect(one.ranking[0].storeId).toBe('a');
  });

  it('computes medians for even and odd counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('opening hours', () => {
  // 2026-11-04 is a Wednesday. 14:00 UTC = 11:00 in São Paulo.
  const wedMorning = new Date('2026-11-04T14:00:00Z');
  const wedNight = new Date('2026-11-05T01:30:00Z'); // 22:30 Wednesday local

  it('reads weekly hours set by the merchant, including past midnight', () => {
    expect(
      isOpenAt(
        { weekly: { wed: [{ open: '08:00', close: '20:00' }] } },
        wedMorning,
      ),
    ).toBe(true);
    expect(
      isOpenAt(
        { weekly: { wed: [{ open: '08:00', close: '20:00' }] } },
        wedNight,
      ),
    ).toBe(false);
    expect(
      isOpenAt(
        { weekly: { wed: [{ open: '18:00', close: '02:00' }] } },
        wedNight,
      ),
    ).toBe(true);
    expect(
      isOpenAt(
        { weekly: { tue: [{ open: '18:00', close: '02:00' }] } },
        new Date('2026-11-04T04:00:00Z'),
      ),
    ).toBe(true);
  });

  it('reads common OSM strings and says null when it cannot', () => {
    expect(
      isOpenAt({ osm: 'Mo-Sa 08:00-21:00; Su 09:00-13:00' }, wedMorning),
    ).toBe(true);
    expect(isOpenAt({ osm: 'Mo-Fr 08:00-12:00,14:00-18:00' }, wedMorning)).toBe(
      true,
    );
    expect(isOpenAt({ osm: 'Mo-Fr 13:00-18:00' }, wedMorning)).toBe(false);
    expect(isOpenAt({ osm: '24/7' }, wedNight)).toBe(true);
    expect(
      isOpenAt(
        { osm: 'Mo-Fr 08:00-18:00; PH off; "sob consulta"' },
        wedMorning,
      ),
    ).toBeNull();
    expect(isOpenAt(null, wedMorning)).toBeNull();
    expect(parseOsmHours('Sa-Mo 10:00-14:00')).toMatchObject({
      sat: [{ open: '10:00' }],
      sun: [{}],
      mon: [{}],
    });
  });
});
