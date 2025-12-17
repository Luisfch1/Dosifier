import { describe, expect, it } from 'vitest';
import { convertLength, convertForce, convertMoment } from '../src/index';

describe('units', () => {
  it('convierte longitudes', () => {
    expect(convertLength(1, 'm', 'mm')).toBe(1000);
    expect(convertLength(10, 'cm', 'mm')).toBe(100);
  });

  it('convierte fuerzas', () => {
    expect(convertForce(1, 'kN', 'N')).toBe(1000);
  });

  it('convierte momentos', () => {
    expect(convertMoment(1, 'kNm', 'Nmm')).toBe(1_000_000);
  });
});
