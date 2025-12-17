import { describe, expect, it } from 'vitest';
import { analyzeBeam } from '../src/solver';
import type { BeamModel } from '../src/model';

function approx(a: number, b: number, tolRel = 5e-3) {
  const denom = Math.max(1, Math.abs(b));
  expect(Math.abs(a - b) / denom).toBeLessThanOrEqual(tolRel);
}

describe('beam solver - golden basics', () => {
  it('simple-simple + udl: reacciones ~ wL/2 y Mmax ~ wL^2/8 (sagado+)', () => {
    const L = 6000; // mm
    const w = 10; // N/mm  => 10 kN/m
    const model: BeamModel = {
      L,
      section: { b: 250, h: 500, cover: 40 },
      material: { Ec: 25000 },
      supports: [
        { x: 0, type: 'simple' },
        { x: L, type: 'simple' },
      ],
      loads: [{ type: 'udl', x1: 0, x2: L, w }],
      diagramPointsPerElement: 80,
    };

    const res = analyzeBeam(model);

    // Reacciones (internal up+)
    const R0 = res.nodes[0].reactionV;
    const R1 = res.nodes[res.nodes.length - 1].reactionV;
    const R_theory = (w * L) / 2; // but w is down+, reaction up+, so +wL/2
    approx(R0, R_theory, 1e-2);
    approx(R1, R_theory, 1e-2);

    // Mmax
    const Mmax = Math.max(...res.diagram.map((p) => p.M));
    const M_theory = (w * L * L) / 8;
    approx(Mmax, M_theory, 2e-2);
  });

  it('simple-simple + point midspan: reacciones ~ P/2 y Mmax ~ PL/4', () => {
    const L = 8000;
    const P = 100000; // N = 100 kN, down+
    const model: BeamModel = {
      L,
      section: { b: 300, h: 600, cover: 40 },
      material: { Ec: 25000 },
      supports: [
        { x: 0, type: 'simple' },
        { x: L, type: 'simple' },
      ],
      loads: [{ type: 'point', x: L / 2, P }],
      diagramPointsPerElement: 120,
    };

    const res = analyzeBeam(model);

    const R_theory = P / 2;
    approx(res.nodes[0].reactionV, R_theory, 1e-2);
    approx(res.nodes[res.nodes.length - 1].reactionV, R_theory, 1e-2);

    const Mmax = Math.max(...res.diagram.map((p) => p.M));
    const M_theory = (P * L) / 4;
    approx(Mmax, M_theory, 2e-2);
  });
});
