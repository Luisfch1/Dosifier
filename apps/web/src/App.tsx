import React, { useMemo, useState } from 'react';
import { defaultBeamModel, type BeamLoad, type BeamModel, type SupportType } from '@concrete/engine';
import { analyzeBeam } from '@concrete/engine';
import { convertLength, convertForce, convertMoment } from '@concrete/units';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type UiUnits = {
  length: 'mm' | 'cm' | 'm';
  force: 'N' | 'kN';
  moment: 'Nmm' | 'kNm';
};

function toInternalModel(ui: BeamModel, units: UiUnits): BeamModel {
  // Convert UI inputs to internal base (mm, N, Nmm).
  const L_mm = convertLength(ui.L, units.length, 'mm');

  const section = {
    b: convertLength(ui.section.b, units.length, 'mm'),
    h: convertLength(ui.section.h, units.length, 'mm'),
    cover: convertLength(ui.section.cover, units.length, 'mm'),
  };

  const supports = ui.supports.map((s) => ({
    x: convertLength(s.x, units.length, 'mm'),
    type: s.type,
  }));

  const loads: BeamLoad[] = ui.loads.map((ld) => {
    if (ld.type === 'point') {
      return { ...ld, x: convertLength(ld.x, units.length, 'mm'), P: convertForce(ld.P, units.force, 'N') };
    }
    if (ld.type === 'udl') {
      // w: force/length
      // Convert: kN/m -> N/mm etc. We do it by converting force and length separately.
      const wN = convertForce(ld.w, units.force, 'N');
      const lenMm = convertLength(1, units.length, 'mm'); // how many mm is 1 unit length
      // If user enters "w" as force per (their length unit), we assume w is per that same unit.
      // So to get N/mm: w(N/unitLen) / (mm/unitLen)
      const wNmm = wN / lenMm;
      return {
        ...ld,
        x1: convertLength(ld.x1, units.length, 'mm'),
        x2: convertLength(ld.x2, units.length, 'mm'),
        w: wNmm,
      };
    }
    // trap
    const w1N = convertForce(ld.w1, units.force, 'N');
    const w2N = convertForce(ld.w2, units.force, 'N');
    const lenMm = convertLength(1, units.length, 'mm');
    return {
      ...ld,
      x1: convertLength(ld.x1, units.length, 'mm'),
      x2: convertLength(ld.x2, units.length, 'mm'),
      w1: w1N / lenMm,
      w2: w2N / lenMm,
    };
  });

  return { ...ui, L: L_mm, section, supports, loads };
}

function fromInternalForce(N: number, units: UiUnits) {
  return convertForce(N, 'N', units.force);
}
function fromInternalMoment(Nmm: number, units: UiUnits) {
  return convertMoment(Nmm, 'Nmm', units.moment);
}
function fromInternalLength(mm: number, units: UiUnits) {
  return convertLength(mm, 'mm', units.length);
}

export default function App() {
  const [units, setUnits] = useState<UiUnits>({ length: 'm', force: 'kN', moment: 'kNm' });

  const [uiModel, setUiModel] = useState<BeamModel>(() => {
    const m = defaultBeamModel();
    // DefaultBeamModel is in internal units; convert to UI default for nicer inputs.
    return {
      ...m,
      L: fromInternalLength(m.L, units),
      section: {
        b: fromInternalLength(m.section.b, units),
        h: fromInternalLength(m.section.h, units),
        cover: fromInternalLength(m.section.cover, units),
      },
      supports: m.supports.map((s) => ({ ...s, x: fromInternalLength(s.x, units) })),
      loads: m.loads.map((ld) => {
        if (ld.type === 'point') {
          return { ...ld, x: fromInternalLength(ld.x, units), P: fromInternalForce(ld.P, units) };
        }
        if (ld.type === 'udl') {
          // internal w is N/mm; convert to user unit: (force unit)/(length unit)
          const w_force = fromInternalForce(ld.w, units); // this gives kN from N/mm (wrong dim) - so we handle separately
          // Better: convert N/mm to (kN/m) etc:
          const w_kN_per_m = (ld.w * 1000) / 1000; // N/mm -> kN/m equals same numeric value
          // Explanation: 1 N/mm = 1 kN/m
          const w_user = units.force === 'kN' && units.length === 'm'
            ? w_kN_per_m
            : w_kN_per_m; // keep simple; detailed mapping later
          return { ...ld, x1: fromInternalLength(ld.x1, units), x2: fromInternalLength(ld.x2, units), w: w_user };
        }
        // trap
        const w1_kN_per_m = ld.w1;
        const w2_kN_per_m = ld.w2;
        const w1_user = w1_kN_per_m;
        const w2_user = w2_kN_per_m;
        return { ...ld, x1: fromInternalLength(ld.x1, units), x2: fromInternalLength(ld.x2, units), w1: w1_user, w2: w2_user };
      }),
    };
  });

  const internalModel = useMemo(() => toInternalModel(uiModel, units), [uiModel, units]);

  const result = useMemo(() => {
    try {
      return analyzeBeam(internalModel);
    } catch (e: any) {
      return { error: e?.message ?? String(e) };
    }
  }, [internalModel]);

  const diagramData = useMemo(() => {
    if ((result as any).error) return [];
    const res: any = result;
    return res.diagram.map((p: any) => ({
      x: fromInternalLength(p.x, units),
      V: fromInternalForce(p.V, units),
      M: fromInternalMoment(p.M, units),
    }));
  }, [result, units]);

  const nodeReactions = useMemo(() => {
    if ((result as any).error) return [];
    const res: any = result;
    return res.nodes
      .filter((n: any) => Math.abs(n.reactionV) > 1e-6 || Math.abs(n.reactionM) > 1e-6)
      .map((n: any) => ({
        x: fromInternalLength(n.x, units),
        RV: fromInternalForce(n.reactionV, units),
        RM: fromInternalMoment(n.reactionM, units),
      }));
  }, [result, units]);

  function updateSupport(i: number, field: 'x' | 'type', value: any) {
    setUiModel((m) => {
      const supports = [...m.supports];
      supports[i] = { ...supports[i], [field]: value };
      return { ...m, supports };
    });
  }

  function addPointLoad() {
    setUiModel((m) => ({
      ...m,
      loads: [...m.loads, { type: 'point', x: m.L / 2, P: 50 }],
    }));
  }

  function addUdlLoad() {
    setUiModel((m) => ({
      ...m,
      loads: [...m.loads, { type: 'udl', x1: 0, x2: m.L, w: 5 }],
    }));
  }

  function updateLoad(idx: number, patch: Partial<BeamLoad>) {
    setUiModel((m) => {
      const loads = [...m.loads];
      loads[idx] = { ...loads[idx], ...patch } as any;
      return { ...m, loads };
    });
  }

  function removeLoad(idx: number) {
    setUiModel((m) => {
      const loads = m.loads.filter((_, i) => i !== idx);
      return { ...m, loads };
    });
  }

  return (
    <div className="container">
      <div className="h1">Concrete</div>
      <div className="small">
        Vigas (NSR-10 + ACI). Cargas positivas hacia abajo. Diagramas: V hacia arriba, M sagado (+).
      </div>

      <div style={{ height: 12 }} />

      <div className="grid">
        <div className="card">
          <div className="h2">Entrada</div>

          <div className="row">
            <div>
              <div className="label">Unidad longitud</div>
              <select value={units.length} onChange={(e) => setUnits((u) => ({ ...u, length: e.target.value as any }))}>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </div>
            <div>
              <div className="label">Unidad fuerza</div>
              <select value={units.force} onChange={(e) => setUnits((u) => ({ ...u, force: e.target.value as any }))}>
                <option value="N">N</option>
                <option value="kN">kN</option>
              </select>
            </div>
          </div>

          <div style={{ height: 10 }} />

          <div className="row">
            <div>
              <div className="label">L (longitud)</div>
              <input
                type="number"
                value={uiModel.L}
                onChange={(e) => setUiModel((m) => ({ ...m, L: Number(e.target.value) }))}
              />
            </div>
            <div>
              <div className="label">E<sub>c</sub> (MPa)</div>
              <input
                type="number"
                value={uiModel.material.Ec}
                onChange={(e) => setUiModel((m) => ({ ...m, material: { ...m.material, Ec: Number(e.target.value) } }))}
              />
            </div>
          </div>

          <div style={{ height: 10 }} />

          <div className="row">
            <div>
              <div className="label">b</div>
              <input
                type="number"
                value={uiModel.section.b}
                onChange={(e) => setUiModel((m) => ({ ...m, section: { ...m.section, b: Number(e.target.value) } }))}
              />
            </div>
            <div>
              <div className="label">h</div>
              <input
                type="number"
                value={uiModel.section.h}
                onChange={(e) => setUiModel((m) => ({ ...m, section: { ...m.section, h: Number(e.target.value) } }))}
              />
            </div>
          </div>

          <div style={{ height: 10 }} />

          <div>
            <div className="label">Apoyos</div>
            {uiModel.supports.map((s, i) => (
              <div className="row" key={i} style={{ marginBottom: 8 }}>
                <div>
                  <input type="number" value={s.x} onChange={(e) => updateSupport(i, 'x', Number(e.target.value))} />
                </div>
                <div>
                  <select value={s.type} onChange={(e) => updateSupport(i, 'type', e.target.value as SupportType)}>
                    <option value="simple">Simple</option>
                    <option value="empotramiento">Empotramiento</option>
                    <option value="libre">Libre</option>
                  </select>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="secondary"
                onClick={() =>
                  setUiModel((m) => ({
                    ...m,
                    supports: [...m.supports, { x: m.L, type: 'simple' }],
                  }))
                }
              >
                + Apoyo
              </button>
              <button
                className="secondary"
                onClick={() => setUiModel((m) => ({ ...m, supports: m.supports.slice(0, Math.max(2, m.supports.length - 1)) }))}
              >
                - Apoyo
              </button>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div>
            <div className="label">Cargas (positivas hacia abajo)</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button className="secondary" onClick={addPointLoad}>+ Puntual</button>
              <button className="secondary" onClick={addUdlLoad}>+ Distribuida</button>
            </div>

            {uiModel.loads.map((ld, idx) => (
              <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="pill">{ld.type === 'point' ? 'Puntual' : ld.type === 'udl' ? 'Distribuida' : 'Trapezoidal'}</div>
                  <button className="secondary" onClick={() => removeLoad(idx)}>Eliminar</button>
                </div>

                <div style={{ height: 8 }} />

                {ld.type === 'point' && (
                  <div className="row">
                    <div>
                      <div className="label">x</div>
                      <input type="number" value={ld.x} onChange={(e) => updateLoad(idx, { x: Number(e.target.value) } as any)} />
                    </div>
                    <div>
                      <div className="label">P</div>
                      <input type="number" value={ld.P} onChange={(e) => updateLoad(idx, { P: Number(e.target.value) } as any)} />
                    </div>
                  </div>
                )}

                {ld.type === 'udl' && (
                  <div className="row">
                    <div>
                      <div className="label">x1</div>
                      <input type="number" value={ld.x1} onChange={(e) => updateLoad(idx, { x1: Number(e.target.value) } as any)} />
                    </div>
                    <div>
                      <div className="label">x2</div>
                      <input type="number" value={ld.x2} onChange={(e) => updateLoad(idx, { x2: Number(e.target.value) } as any)} />
                    </div>
                    <div>
                      <div className="label">w</div>
                      <input type="number" value={ld.w} onChange={(e) => updateLoad(idx, { w: Number(e.target.value) } as any)} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {(result as any).error && (
            <div style={{ marginTop: 10, color: '#b91c1c' }}>
              Error: {(result as any).error}
            </div>
          )}

          <div style={{ height: 12 }} />
          <div className="small">
            Nota: el motor hoy ya calcula V/M con apoyos arbitrarios. Lo siguiente es el módulo de diseño y despiece.
          </div>
        </div>

        <div className="card">
          <div className="h2">Resultados</div>

          <div className="small" style={{ marginBottom: 10 }}>
            Reacciones (solo nodos con reacción):
            {nodeReactions.length === 0 ? ' (sin datos)' : ''}
          </div>

          {nodeReactions.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {nodeReactions.map((r, i) => (
                <div key={i} className="small">
                  x={r.x.toFixed(3)} {units.length} → Rv={r.RV.toFixed(3)} {units.force}, Rm={r.RM.toFixed(3)} {units.moment}
                </div>
              ))}
            </div>
          )}

          <div className="h2">Cortante V(x)</div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={diagramData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" tickFormatter={(v) => Number(v).toFixed(2)} />
                <YAxis tickFormatter={(v) => Number(v).toFixed(2)} />
                <Tooltip />
                <Line type="monotone" dataKey="V" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ height: 16 }} />

          <div className="h2">Momento M(x)</div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={diagramData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" tickFormatter={(v) => Number(v).toFixed(2)} />
                <YAxis tickFormatter={(v) => Number(v).toFixed(2)} />
                <Tooltip />
                <Line type="monotone" dataKey="M" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ height: 12 }} />
          <div className="small">
            Próximo: aquí mismo añadimos el overlay de capacidad φMn(x)/φVn(x) según el acero que proponga el usuario.
          </div>
        </div>
      </div>
    </div>
  );
}
