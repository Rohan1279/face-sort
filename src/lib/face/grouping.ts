export type Settings = { threshold: number; lowFit: number; lowMargin: number };

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / Math.sqrt(na * nb);
}

export type Confidence = { fit: number | null; margin: number; closest: number; lowFit: boolean; lowMargin: boolean };

export type Tree = { sims: number[][]; merges: { a: number; b: number; sim: number }[] };

export function groupFaces(faces: { embedding: ArrayLike<number>; photo: number }[], settings: Settings) {
  return cutTree(buildTree(faces), settings);
}

export function buildTree(faces: { embedding: ArrayLike<number>; photo: number }[]): Tree {
  const sims = faces.map((a, i) => faces.map((b, j) => (i !== j && a.photo === b.photo ? -Infinity : cosine(a.embedding, b.embedding))));
  const n = sims.length;
  const D = sims.map((row) => row.slice());
  const size = sims.map(() => 1);
  const alive = sims.map(() => true);
  const merges: Tree["merges"] = [];
  for (;;) {
    let bi = -1, bj = -1, best = -Infinity;
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      for (let j = i + 1; j < n; j++) if (alive[j] && D[i][j] > -Infinity && D[i][j] >= best) [bi, bj, best] = [i, j, D[i][j]];
    }
    if (bi < 0) break;
    for (let k = 0; k < n; k++) {
      if (alive[k] && k !== bi && k !== bj) D[bi][k] = D[k][bi] = (size[bi] * D[bi][k] + size[bj] * D[bj][k]) / (size[bi] + size[bj]);
    }
    size[bi] += size[bj];
    alive[bj] = false;
    merges.push({ a: bi, b: bj, sim: best });
  }
  return { sims, merges };
}

export function cutTree({ sims, merges }: Tree, settings: Settings) {
  const members = sims.map((_, i) => [i]);
  const alive = sims.map(() => true);
  for (const { a, b, sim } of merges) {
    if (sim < settings.threshold) break;
    members[a].push(...members[b]);
    alive[b] = false;
  }
  const groups = members.filter((_, i) => alive[i]).sort((a, b) => b.length - a.length);
  const groupOf: number[] = [];
  groups.forEach((g, gi) => g.forEach((fi) => (groupOf[fi] = gi)));
  return { groups, groupOf, confidence: confidence(groups, sims, settings) };
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
