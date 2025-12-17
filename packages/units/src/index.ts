export type LengthUnit = 'mm' | 'cm' | 'm';
export type ForceUnit = 'N' | 'kN';
export type MomentUnit = 'Nmm' | 'kNm';
export type StressUnit = 'MPa' | 'Pa';

const lengthToMm: Record<LengthUnit, number> = { mm: 1, cm: 10, m: 1000 };
const forceToN: Record<ForceUnit, number> = { N: 1, kN: 1000 };
const momentToNmm: Record<MomentUnit, number> = { Nmm: 1, kNm: 1_000_000 };
const stressToPa: Record<StressUnit, number> = { Pa: 1, MPa: 1_000_000 };

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  return (value * lengthToMm[from]) / lengthToMm[to];
}

export function convertForce(value: number, from: ForceUnit, to: ForceUnit): number {
  return (value * forceToN[from]) / forceToN[to];
}

export function convertMoment(value: number, from: MomentUnit, to: MomentUnit): number {
  return (value * momentToNmm[from]) / momentToNmm[to];
}

export function convertStress(value: number, from: StressUnit, to: StressUnit): number {
  return (value * stressToPa[from]) / stressToPa[to];
}

/**
 * Base interna recomendada:
 * - Longitud: mm
 * - Fuerza: N
 * - Momento: N*mm
 * - Esfuerzo: MPa (o Pa si prefieres SI puro)
 */
export const internal = {
  length: 'mm' as const,
  force: 'N' as const,
  moment: 'Nmm' as const,
};
