export type Settings = { threshold: number; lowFit: number; lowMargin: number };

function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / Math.sqrt(na * nb);
}

export type Confidence = { fit: number | null; margin: number; closest: number; lowFit: boolean; lowMargin: boolean };

export function groupFaces(faces: { embedding: ArrayLike<number>; photo: number }[], settings: Settings) {
  const sims = similarityMatrix(faces.map((f) => f.embedding), faces.map((f) => f.photo));
  const groups = cluster(sims, settings.threshold);
  const groupOf: number[] = [];
  groups.forEach((g, gi) => g.forEach((fi) => (groupOf[fi] = gi)));
  return { groups, groupOf, confidence: confidence(groups, sims, settings) };
}

function similarityMatrix(embeddings: ArrayLike<number>[], photoOf: number[]): number[][] {
  return embeddings.map((a, i) => embeddings.map((b, j) => (i !== j && photoOf[i] === photoOf[j] ? -Infinity : cosine(a, b))));
}

function cluster(sims: number[][], threshold: number): number[][] {
  const n = sims.length;
  const D = sims.map((row) => row.slice());
  const members = sims.map((_, i) => [i]);
  const alive = sims.map(() => true);
  for (;;) {
    let bi = -1, bj = -1, best = threshold;
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      for (let j = i + 1; j < n; j++) if (alive[j] && D[i][j] >= best) [bi, bj, best] = [i, j, D[i][j]];
    }
    if (bi < 0) break;
    const [ni, nj] = [members[bi].length, members[bj].length];
    for (let k = 0; k < n; k++) {
      if (alive[k] && k !== bi && k !== bj) D[bi][k] = D[k][bi] = (ni * D[bi][k] + nj * D[bj][k]) / (ni + nj);
    }
    members[bi].push(...members[bj]);
    alive[bj] = false;
  }
  return members.filter((_, i) => alive[i]).sort((a, b) => b.length - a.length);
}

function confidence(groups: number[][], sims: number[][], { threshold, lowFit, lowMargin }: Settings): Confidence[] {
  const out: Confidence[] = [];
  groups.forEach((group, gi) => {
    for (const i of group) {
      const fit = group.length > 1 ? group.reduce((s, j) => s + (j === i ? 0 : sims[i][j]), 0) / (group.length - 1) : null;
      let other = -Infinity, closest = -1;
      groups.forEach((g, h) => {
        if (h === gi) return;
        const s = g.reduce((sum, j) => sum + sims[i][j], 0) / g.length;
        if (s > other) [other, closest] = [s, h];
      });
      const margin = (fit ?? threshold) - other;
      out[i] = { fit, margin, closest, lowFit: fit !== null && fit < lowFit, lowMargin: margin < lowMargin };
    }
  });
  return out;
}
