export type DiagramPoint = {
  x: number; // mm
  V: number; // N (positivo hacia arriba)
  M: number; // Nmm (positivo sagado)
};

export type NodeResult = {
  x: number;
  v: number; // mm (positivo hacia arriba)
  theta: number; // rad
  reactionV: number; // N
  reactionM: number; // Nmm
};

export type BeamAnalysisResult = {
  nodes: NodeResult[];
  diagram: DiagramPoint[];
  meta: {
    signConvention: 'user_down_positive__internal_up_positive';
  };
};
