import type { BeamModel, BeamLoad, SupportType } from './model';
import type { BeamAnalysisResult, NodeResult, DiagramPoint } from './results';

type Node = { x: number; support: SupportType | null };
type Element = { i: number; j: number; L: number; EI: number; loads: BeamLoad[] };

function uniqueSorted(values: number[]): number[] {
  const eps = 1e-9;
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || Math.abs(out[out.length - 1] - v) > eps) out.push(v);
  }
  return out;
}

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

function beamElementStiffness(EI: number, L: number): number[][] {
  // DOF order: [v_i, theta_i, v_j, theta_j], v up positive.
  const L2 = L * L;
  const L3 = L2 * L;
  const k = (EI / L3) * 1.0;

  return [
    [12 * k, 6 * L * k, -12 * k, 6 * L * k],
    [6 * L * k, 4 * L2 * k, -6 * L * k, 2 * L2 * k],
    [-12 * k, -6 * L * k, 12 * k, -6 * L * k],
    [6 * L * k, 2 * L2 * k, -6 * L * k, 4 * L2 * k],
  ];
}

function addToGlobalMatrix(K: number[][], dofs: number[], ke: number[][]) {
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      K[dofs[a]][dofs[b]] += ke[a][b];
    }
  }
}

function addToGlobalVector(F: number[], dofs: number[], fe: number[]) {
  for (let a = 0; a < 4; a++) {
    F[dofs[a]] += fe[a];
  }
}

function shapeFunctions(ksi: number, L: number) {
  // Hermite cubic beam shape functions for deflection
  const N1 = 1 - 3 * ksi ** 2 + 2 * ksi ** 3;
  const N2 = L * (ksi - 2 * ksi ** 2 + ksi ** 3);
  const N3 = 3 * ksi ** 2 - 2 * ksi ** 3;
  const N4 = L * (-ksi ** 2 + ksi ** 3);
  return [N1, N2, N3, N4];
}

function equivalentNodalForcesForLoad(load: BeamLoad, x0: number, x1: number): number[] {
  // Returns [Fv_i, M_i, Fv_j, M_j] in INTERNAL convention (F up +, v up +).
  // User input is down +, so we convert to internal by multiplying by -1 here.
  const L = x1 - x0;
  const fe = [0, 0, 0, 0]; // internal dofs [v_i, theta_i, v_j, theta_j]
  if (load.type === 'point') {
    const xp = load.x;
    if (xp < x0 - 1e-9 || xp > x1 + 1e-9) return fe;
    const ksi = clamp((xp - x0) / L, 0, 1);
    const [N1, N2, N3, N4] = shapeFunctions(ksi, L);
    const P_internal = -load.P; // down+ => internal up+
    fe[0] += N1 * P_internal;
    fe[1] += N2 * P_internal;
    fe[2] += N3 * P_internal;
    fe[3] += N4 * P_internal;
    return fe;
  }
  if (load.type === 'udl') {
    const a = Math.max(load.x1, x0);
    const b = Math.min(load.x2, x1);
    if (b <= a) return fe;

    // If udl covers entire element, use closed form.
    // Else, split into a partial trapezoid over [a,b] mapped to element.
    const w = load.w;
    const w_internal = -w; // down+ => internal up+
    // We'll approximate partial coverage by converting to equivalent nodal forces using
    // numerical integration (safe & general).
    return equivalentNodalForcesByIntegration(
      (x) => w_internal,
      x0,
      x1,
      a,
      b,
      20,
    );
  }
  if (load.type === 'trap') {
    const a = Math.max(load.x1, x0);
    const b = Math.min(load.x2, x1);
    if (b <= a) return fe;

    // Linear interpolation of w between x1..x2, then integrate on [a,b].
    const w1 = load.w1;
    const w2 = load.w2;
    const xA = load.x1;
    const xB = load.x2;
    const w_internal = (x: number) => {
      const t = (x - xA) / (xB - xA);
      const w = w1 + (w2 - w1) * t;
      return -w; // down+ => internal up+
    };
    return equivalentNodalForcesByIntegration(w_internal, x0, x1, a, b, 30);
  }
  return fe;
}

function equivalentNodalForcesByIntegration(
  q: (x: number) => number, // force per length, internal (up +)
  x0: number,
  x1: number,
  a: number,
  b: number,
  n: number,
): number[] {
  // Consistent nodal loads: f = ∫ N^T q dx over coverage [a,b]
  const L = x1 - x0;
  const fe = [0, 0, 0, 0];
  const h = (b - a) / n;

  for (let k = 0; k <= n; k++) {
    const x = a + k * h;
    const ksi = (x - x0) / L;
    const [N1, N2, N3, N4] = shapeFunctions(ksi, L);
    const weight = k === 0 || k === n ? 0.5 : 1.0; // trapezoidal rule
    const qx = q(x);
    fe[0] += weight * N1 * qx * h;
    fe[1] += weight * N2 * qx * h;
    fe[2] += weight * N3 * qx * h;
    fe[3] += weight * N4 * qx * h;
  }
  return fe;
}

function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

function zeros2(n: number): number[][] {
  return Array.from({ length: n }, () => zeros(n));
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  // Gaussian elimination with partial pivoting (suficiente para tamaños pequeños)
  const n = b.length;
  const M = A.map((row) => [...row]);
  const x = [...b];

  for (let k = 0; k < n; k++) {
    // pivot
    let piv = k;
    let max = Math.abs(M[k][k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(M[i][k]);
      if (v > max) {
        max = v;
        piv = i;
      }
    }
    if (max < 1e-12) throw new Error('Sistema singular o mal condicionado.');

    if (piv !== k) {
      [M[k], M[piv]] = [M[piv], M[k]];
      [x[k], x[piv]] = [x[piv], x[k]];
    }

    const akk = M[k][k];
    for (let j = k; j < n; j++) M[k][j] /= akk;
    x[k] /= akk;

    for (let i = k + 1; i < n; i++) {
      const f = M[i][k];
      if (Math.abs(f) < 1e-15) continue;
      for (let j = k; j < n; j++) M[i][j] -= f * M[k][j];
      x[i] -= f * x[k];
    }
  }

  // back substitution
  const sol = zeros(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * sol[j];
    sol[i] = s;
  }
  return sol;
}

function buildMesh(model: BeamModel): { nodes: Node[]; elements: Element[] } {
  const xs: number[] = [0, model.L];

  for (const s of model.supports) xs.push(s.x);
  for (const load of model.loads) {
    if (load.type === 'point') xs.push(load.x);
    if (load.type === 'udl' || load.type === 'trap') {
      xs.push(load.x1, load.x2);
    }
  }

  const xNodes = uniqueSorted(xs.map((v) => clamp(v, 0, model.L)));

  const supportMap = new Map<number, SupportType>();
  for (const s of model.supports) supportMap.set(s.x, s.type);

  const nodes: Node[] = xNodes.map((x) => ({ x, support: supportMap.get(x) ?? null }));

  // EI from section
  const b = model.section.b;
  const h = model.section.h;
  const I = (b * h ** 3) / 12; // mm^4
  const E = model.material.Ec; // MPa = N/mm^2
  const EI = E * I; // N*mm^2

  const elements: Element[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const x0 = nodes[i].x;
    const x1 = nodes[i + 1].x;
    const L = x1 - x0;
    const loads = model.loads.filter((ld) => {
      if (ld.type === 'point') return ld.x >= x0 - 1e-9 && ld.x <= x1 + 1e-9;
      if (ld.type === 'udl' || ld.type === 'trap') return !(ld.x2 <= x0 || ld.x1 >= x1);
      return false;
    });
    elements.push({ i, j: i + 1, L, EI, loads });
  }
  return { nodes, elements };
}

function dofIndex(nodeIndex: number, dof: 'v' | 't'): number {
  return nodeIndex * 2 + (dof === 'v' ? 0 : 1);
}

function constraintsForSupport(type: SupportType): { fixV: boolean; fixT: boolean } {
  if (type === 'simple') return { fixV: true, fixT: false };
  if (type === 'empotramiento') return { fixV: true, fixT: true };
  return { fixV: false, fixT: false };
}

export function analyzeBeam(model: BeamModel): BeamAnalysisResult {
  const { nodes, elements } = buildMesh(model);
  const ndof = nodes.length * 2;
  const K = zeros2(ndof);
  const F = zeros(ndof);

  // Assemble
  for (const e of elements) {
    const ni = e.i;
    const nj = e.j;
    const x0 = nodes[ni].x;
    const x1 = nodes[nj].x;

    const ke = beamElementStiffness(e.EI, e.L);
    const dofs = [dofIndex(ni, 'v'), dofIndex(ni, 't'), dofIndex(nj, 'v'), dofIndex(nj, 't')];
    addToGlobalMatrix(K, dofs, ke);

    // Equivalent nodal loads
    let fe = [0, 0, 0, 0];
    for (const ld of e.loads) {
      const add = equivalentNodalForcesForLoad(ld, x0, x1);
      for (let k = 0; k < 4; k++) fe[k] += add[k];
    }
    addToGlobalVector(F, dofs, fe);
  }

  // Apply constraints
  const fixed: boolean[] = Array.from({ length: ndof }, () => false);
  for (let i = 0; i < nodes.length; i++) {
    const s = nodes[i].support;
    if (!s) continue;
    const c = constraintsForSupport(s);
    if (c.fixV) fixed[dofIndex(i, 'v')] = true;
    if (c.fixT) fixed[dofIndex(i, 't')] = true;
  }

  const freeIdx: number[] = [];
  const fixedIdx: number[] = [];
  for (let i = 0; i < ndof; i++) (fixed[i] ? fixedIdx : freeIdx).push(i);

  const Kff = freeIdx.map((r) => freeIdx.map((c) => K[r][c]));
  const Ff = freeIdx.map((r) => F[r]);

  const uf = solveLinearSystem(Kff, Ff);

  const u = zeros(ndof);
  for (let k = 0; k < freeIdx.length; k++) u[freeIdx[k]] = uf[k];
  // fixed dofs already 0

  // Reactions: R = K u - F
  const Ru = zeros(ndof);
  for (let i = 0; i < ndof; i++) {
    let s = 0;
    for (let j = 0; j < ndof; j++) s += K[i][j] * u[j];
    Ru[i] = s - F[i];
  }

  const nodeResults: NodeResult[] = nodes.map((n, i) => {
    const v = u[dofIndex(i, 'v')];
    const t = u[dofIndex(i, 't')];
    const rV = Ru[dofIndex(i, 'v')];
    const rM = Ru[dofIndex(i, 't')];
    return { x: n.x, v, theta: t, reactionV: rV, reactionM: rM };
  });

  // Build diagrams by equilibrium using element end forces + applied loads
  const ptsPerEl = model.diagramPointsPerElement ?? 25;
  const diagram: DiagramPoint[] = [];

  for (const e of elements) {
    const ni = e.i;
    const nj = e.j;
    const x0 = nodes[ni].x;
    const x1 = nodes[nj].x;
    const L = x1 - x0;
    const dofs = [dofIndex(ni, 'v'), dofIndex(ni, 't'), dofIndex(nj, 'v'), dofIndex(nj, 't')];
    const ue = dofs.map((d) => u[d]);

    const ke = beamElementStiffness(e.EI, e.L);

    // fe (assembled consistent loads) for this element
    let fe = [0, 0, 0, 0];
    for (const ld of e.loads) {
      const add = equivalentNodalForcesForLoad(ld, x0, x1);
      for (let k = 0; k < 4; k++) fe[k] += add[k];
    }

    // element end forces (internal) q = ke*ue - fe
    const q = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      let s = 0;
      for (let j = 0; j < 4; j++) s += ke[i][j] * ue[j];
      q[i] = s - fe[i];
    }

    // q[0] = V_left (up+), q[1] = M_left (CCW+)
    // Convert M_left to sagging-positive: In this convention, CCW at left corresponds to hogging-negative.
    // So sagging M = -M_ccw at left. We'll validate with tests.
    const V0 = q[0];
    const M0_sag = -q[1];

    const localPoints: DiagramPoint[] = [];
    for (let k = 0; k <= ptsPerEl; k++) {
      const x = x0 + (L * k) / ptsPerEl;
      const xl = x - x0;

      // Compute load contributions up to x within this element.
      let dV = 0; // up+
      let dM = 0; // sagging+

      // Distributed loads: integrate q(s) with sign (user down+ => internal up-)
      // We'll numerically integrate based on loads list for simplicity.
      const nInt = 40;
      const h = xl / nInt;

      let int_q = 0; // ∫ q(s) ds (internal up+)
      let int_q_x = 0; // ∫ q(s)*(x-s) ds
      for (let i = 0; i <= nInt; i++) {
        const s = i * h;
        const xs = x0 + s;
        const w_internal = totalDistributedInternal(e.loads, xs); // N/mm up+
        const weight = i === 0 || i === nInt ? 0.5 : 1.0;
        int_q += weight * w_internal * h;
        int_q_x += weight * w_internal * (xl - s) * h;
      }

      dV += int_q; // since internal distributed load adds to shear
      dM += int_q_x;

      // Point loads inside element at positions <= x
      for (const ld of e.loads) {
        if (ld.type !== 'point') continue;
        if (ld.x < x0 - 1e-9 || ld.x > x + 1e-9) continue;
        const P_internal = -ld.P; // up+
        dV += P_internal;
        dM += P_internal * (xl - (ld.x - x0));
      }

      const V = V0 + dV;
      const M = M0_sag + V0 * xl + dM;

      localPoints.push({ x, V, M });
    }

    // Avoid duplicating node points
    if (diagram.length > 0 && localPoints.length > 0) localPoints.shift();
    diagram.push(...localPoints);
  }

  return {
    nodes: nodeResults,
    diagram,
    meta: { signConvention: 'user_down_positive__internal_up_positive' },
  };
}

function totalDistributedInternal(loads: BeamLoad[], x: number): number {
  // Return q(x) as internal distributed load (up+). User input is down+, so internal is negative.
  let q = 0;
  for (const ld of loads) {
    if (ld.type === 'udl') {
      if (x >= ld.x1 - 1e-9 && x <= ld.x2 + 1e-9) q += -ld.w;
    } else if (ld.type === 'trap') {
      if (x >= ld.x1 - 1e-9 && x <= ld.x2 + 1e-9) {
        const t = (x - ld.x1) / (ld.x2 - ld.x1);
        const w = ld.w1 + (ld.w2 - ld.w1) * t;
        q += -w;
      }
    }
  }
  return q;
}
