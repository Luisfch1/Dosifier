export type SupportType = 'libre' | 'simple' | 'empotramiento';

export type PointLoad = { type: 'point'; x: number; P: number }; // P > 0 hacia abajo
export type UdlLoad = { type: 'udl'; x1: number; x2: number; w: number }; // w > 0 hacia abajo
export type TrapLoad = { type: 'trap'; x1: number; x2: number; w1: number; w2: number }; // >0 hacia abajo

export type BeamLoad = PointLoad | UdlLoad | TrapLoad;

export type BeamSection = {
  b: number; // mm
  h: number; // mm
  cover: number; // mm
};

export type BeamMaterial = {
  Ec: number; // MPa
};

export type BeamModel = {
  L: number; // mm
  section: BeamSection;
  material: BeamMaterial;
  supports: Array<{ x: number; type: SupportType }>;
  loads: BeamLoad[];
  /**
   * Para diagramas: número mínimo de puntos por elemento.
   * El solver puede densificar donde haya cambios de carga.
   */
  diagramPointsPerElement?: number; // default 20
};

export function defaultBeamModel(): BeamModel {
  return {
    L: 6000,
    section: { b: 250, h: 500, cover: 40 },
    material: { Ec: 25000 }, // MPa típico
    supports: [
      { x: 0, type: 'simple' },
      { x: 6000, type: 'simple' },
    ],
    loads: [{ type: 'udl', x1: 0, x2: 6000, w: 10 }], // 10 N/mm = 10 kN/m (si mm)
    diagramPointsPerElement: 25,
  };
}
