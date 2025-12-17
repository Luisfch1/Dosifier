# Convenciones

## Ejes
- La viga se define en el eje X, desde x=0 (izquierda) a x=L (derecha).

## Signos (entrada del usuario)
- Cargas **positivas hacia abajo**:
  - Puntual: P > 0 hacia abajo
  - Distribuida: w > 0 hacia abajo
  - Trapezoidal: w1, w2 > 0 hacia abajo

## Signos (interno FE)
- El solver usa convención típica de FE:
  - Desplazamiento vertical v: positivo hacia **arriba**
  - Fuerza nodal vertical F: positivo hacia **arriba**
- Por eso, al ensamblar, las cargas de usuario se convierten con signo negativo.

## Diagramas de salida
- Cortante V(x): positivo hacia arriba.
- Momento M(x): positivo **sagado** (tensión abajo).

Los golden tests validan que, para una viga simplemente apoyada con carga uniforme hacia abajo,
el máximo momento sea +wL^2/8.
