import { toCompanyRecord } from '../integrations/brasil-api/brasil-api.provider.js';
import { toGeocodedPlace } from '../integrations/nominatim/nominatim.provider.js';
import {
  overpassQuery,
  toPlaceCandidate,
} from '../integrations/osm/osm.mapper.js';
import type { CompanyRecord } from '../integrations/providers.js';
import { decideVerification } from './verification.rules.js';

const company: CompanyRecord = {
  cnpj: '11222333000181',
  legalName: 'BOM PRECO SUPERMERCADOS LTDA',
  tradeName: 'MERCADO BOM PRECO',
  registrationStatus: 'ATIVA',
  address: { city: 'SAO PAULO', state: 'SP', postcode: '04036000' },
};

describe('decideVerification', () => {
  it('verifies when city, state and CEP prefix match', () => {
    const decision = decideVerification(company, {
      name: 'Outro nome qualquer',
      address: { city: 'São Paulo', state: 'sp', postcode: '04036-120' },
    });
    expect(decision.status).toBe('VERIFIED');
  });

  it('verifies with a similar name when the CEP differs', () => {
    expect(
      decideVerification(company, {
        name: 'Mercado Bom Preço',
        address: { city: 'São Paulo', state: 'SP', postcode: '01310-100' },
      }).status,
    ).toBe('VERIFIED');
  });

  it('leaves it for an admin when the city does not match', () => {
    const decision = decideVerification(company, {
      name: 'Mercado Bom Preço',
      address: { city: 'Campinas', state: 'SP', postcode: '04036-000' },
    });
    expect(decision.status).toBe('PENDING');
    expect(decision.checks.sameCity).toBe(false);
  });

  it('rejects companies that are not active', () => {
    expect(
      decideVerification(
        { ...company, registrationStatus: 'BAIXADA' },
        { name: 'Mercado Bom Preço', address: company.address },
      ).status,
    ).toBe('REJECTED');
  });
});

describe('OpenStreetMap mapping', () => {
  it('keeps named shops with categories and address', () => {
    const place = toPlaceCandidate({
      type: 'node',
      id: 42,
      lat: -23.58,
      lon: -46.63,
      tags: {
        shop: 'supermarket',
        name: 'Mercado da Vila',
        'addr:street': 'Rua Vergueiro',
        'addr:housenumber': '100',
        'addr:city': 'São Paulo',
        'addr:state': 'BR-SP',
        opening_hours: 'Mo-Sa 08:00-21:00',
      },
    });
    expect(place).toEqual({
      externalId: 'node/42',
      name: 'Mercado da Vila',
      lat: -23.58,
      lng: -46.63,
      address: {
        street: 'Rua Vergueiro',
        number: '100',
        city: 'São Paulo',
        state: 'SP',
      },
      openingHours: { osm: 'Mo-Sa 08:00-21:00' },
      categorySlugs: ['alimentos'],
    });
  });

  it('uses the center of ways and maps pharmacies', () => {
    const place = toPlaceCandidate({
      type: 'way',
      id: 7,
      center: { lat: -23.5, lon: -46.6 },
      tags: { amenity: 'pharmacy', name: 'Drogaria Exemplo' },
    });
    expect(place).toMatchObject({
      externalId: 'way/7',
      lat: -23.5,
      categorySlugs: ['farmacia', 'medicamentos'],
    });
  });

  it('drops services, unnamed places and other amenities', () => {
    const base = { type: 'node' as const, id: 1, lat: 0, lon: 0 };
    expect(
      toPlaceCandidate({
        ...base,
        tags: { shop: 'hairdresser', name: 'Barbearia' },
      }),
    ).toBeNull();
    expect(
      toPlaceCandidate({ ...base, tags: { shop: 'supermarket' } }),
    ).toBeNull();
    expect(
      toPlaceCandidate({
        ...base,
        tags: { amenity: 'restaurant', name: 'Restaurante' },
      }),
    ).toBeNull();
  });

  it('builds a bbox query for named shops', () => {
    const query = overpassQuery(
      { south: -23.6, west: -46.65, north: -23.55, east: -46.6 },
      60,
    );
    expect(query).toContain('[bbox:-23.6,-46.65,-23.55,-46.6]');
    expect(query).toContain('nwr["shop"]["name"]');
  });
});

describe('external payload mapping', () => {
  it('maps BrasilAPI CNPJ records', () => {
    expect(
      toCompanyRecord({
        cnpj: '00000000000191',
        razao_social: 'BANCO DO BRASIL SA',
        nome_fantasia: '',
        descricao_situacao_cadastral: 'ATIVA',
        descricao_tipo_de_logradouro: 'QUADRA',
        logradouro: 'SAUN QUADRA 5',
        municipio: 'BRASILIA',
        uf: 'DF',
        cep: '70040912',
      }),
    ).toEqual({
      cnpj: '00000000000191',
      legalName: 'BANCO DO BRASIL SA',
      tradeName: null,
      registrationStatus: 'ATIVA',
      address: {
        street: 'QUADRA SAUN QUADRA 5',
        city: 'BRASILIA',
        state: 'DF',
        postcode: '70040912',
      },
    });
  });

  it('maps Nominatim addresses with the state code', () => {
    const place = toGeocodedPlace({
      lat: '-23.5936',
      lon: '-46.637',
      display_name: 'Rua Domingos de Morais, 2000, Vila Mariana, São Paulo',
      address: {
        road: 'Rua Domingos de Morais',
        house_number: '2000',
        suburb: 'Vila Mariana',
        city: 'São Paulo',
        'ISO3166-2-lvl4': 'BR-SP',
        postcode: '04036-000',
      },
    });
    expect(place.address).toEqual({
      street: 'Rua Domingos de Morais',
      number: '2000',
      district: 'Vila Mariana',
      city: 'São Paulo',
      state: 'SP',
      postcode: '04036-000',
    });
    expect(place.lat).toBeCloseTo(-23.5936);
  });
});
