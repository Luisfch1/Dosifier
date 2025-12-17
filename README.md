# Concrete (NSR + ACI)

App para diseño de elementos de concreto reforzado con base en la **NSR-10 (Colombia)** y **fallback a ACI** cuando existan vacíos o aclaraciones.

## Alcance V1 (Vigas)
- Análisis de vigas con apoyos arbitrarios (solver por rigidez 1D)
- Cargas puntuales, distribuidas y trapezoidales
- Diagramas V(x) y M(x)
- Diseño a flexión y cortante (placeholder en V1.0 del repo; se implementa en los siguientes issues)
- Gráficos Demanda vs Capacidad (Mu/Vu vs φMn/φVn) (UI base lista)
- Despiece con longitud máxima comercial de varilla (6 m / 12 m) (placeholder en V1.0 del repo)
- Unidades flexibles (entrada/salida con conversión)

## Requisitos
- Node.js >= 20
- pnpm >= 9

## Cómo correr
```bash
pnpm install
pnpm test
pnpm dev
```

- App web: abre la URL que muestre Vite (por defecto http://localhost:5173)
- La app está preparada para PWA (offline) cuando se haga `pnpm build` y se sirva el build.

## Estructura (monorepo)
- `apps/web` → UI + gráficos
- `packages/engine` → solver + (próximos) diseño y despiece
- `packages/units` → conversiones de unidades
- `packages/tests-golden` → casos “verdad” y helpers

## Convenciones de signos (por defecto)
- Cargas **positivas hacia abajo** (entrada).
- El motor convierte internamente a convención FE (fuerza hacia arriba positiva).
- Momentos en salida: **sagado (tensión abajo) positivo**.

Más detalle en `docs/01-convenciones.md`.
