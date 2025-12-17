# Modelo de viga (JSON)

El modelo base vive en `packages/engine/src/model.ts`.

- Soportes por nodo:
  - `simple`: v fijo, θ libre
  - `empotramiento`: v fijo, θ fijo
  - `libre`: v libre, θ libre

- Cargas:
  - `point`: { x, P }  (P positivo hacia abajo)
  - `udl`: { x1, x2, w } (w positivo hacia abajo)
  - `trap`: { x1, x2, w1, w2 } (positivos hacia abajo)

El solver discretiza automáticamente la viga en nodos en:
- extremos
- puntos de apoyos
- puntos de cambio de carga (x1, x2, x de carga puntual)
