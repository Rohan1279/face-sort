import type { DetectedFace, Engine, Rejection } from "./engine";
import { buildTree, cosine, cutTree, type Confidence, type Settings, type Tree } from "./grouping.ts";

export type Face = DetectedFace & { photo: number };
export type Person = { id: number; faces: number[]; photos: number[] };
export type Reason = Rejection["reason"] | "none" | "unreadable";
export type SortResult = {
  faces: Face[];
  people: Person[];
  personOf: number[];
  confidence: Confidence[];
  unsorted: number[];
  reason: Record<number, Reason>;
  tree?: Tree;
};

export async function sortPhotos(
  photos: File[],
  engine: Engine,
  onProgress: (progress: { done: number; total: number; result?: SortResult }) => void = () => {},
): Promise<SortResult> {
  const faces: Face[] = [];
  const reason: Record<number, Reason> = {};
  const people: Person[] = [];
  const personOf: number[] = [];
  for (const [i, photo] of photos.entries()) {
    try {
      const { faces: found, rejected } = await engine.detect(photo);
      for (const f of found) {
        faces.push({ ...f, photo: i });
        place(faces, faces.length - 1, people, personOf, engine.settings.threshold);
      }
      if (!found.length) reason[i] = rejected.length ? rejected.reduce((a, b) => (b.size > a.size ? b : a)).reason : "none";
    } catch {
      reason[i] = "unreadable";
    }
    const result = i < photos.length - 1
      ? { faces: faces.slice(), people: people.slice(), personOf: personOf.slice(), confidence: [], unsorted: Object.keys(reason).map(Number), reason: { ...reason } }
      : undefined;
    onProgress({ done: i + 1, total: photos.length, result });
  }
  return summarize(faces, reason, buildTree(faces), engine.settings, people, { id: people.length + 1 });
}

function place(faces: Face[], fi: number, people: Person[], personOf: number[], threshold: number) {
  const face = faces[fi];
  let best = -1, bestSim = threshold;
  people.forEach((p, pi) => {
    if (p.photos.includes(face.photo)) return;
    const sim = p.faces.reduce((s, j) => s + cosine(face.embedding, faces[j].embedding), 0) / p.faces.length;
    if (sim >= bestSim) [best, bestSim] = [pi, sim];
  });
  if (best < 0) {
    personOf[fi] = people.length;
    people.push({ id: people.length + 1, faces: [fi], photos: [face.photo] });
  } else {
    personOf[fi] = best;
    const p = people[best];
    people[best] = { ...p, faces: [...p.faces, fi], photos: [...p.photos, face.photo] };
  }
}

export function assignIds(groups: number[][], previous: Person[], nextId: { id: number }): number[] {
  const owner = new Map<number, number>();
  previous.forEach((p) => p.faces.forEach((f) => owner.set(f, p.id)));
  const overlaps: { group: number; id: number; shared: number }[] = [];
  groups.forEach((g, group) => {
    const counts = new Map<number, number>();
    for (const f of g) {
      const id = owner.get(f);
      if (id !== undefined) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    counts.forEach((shared, id) => overlaps.push({ group, id, shared }));
  });
  overlaps.sort((a, b) => b.shared - a.shared);
  const ids: number[] = [];
  const taken = new Set<number>();
  for (const { group, id } of overlaps) {
    if (ids[group] === undefined && !taken.has(id)) {
      ids[group] = id;
      taken.add(id);
    }
  }
  return groups.map((_, group) => ids[group] ?? nextId.id++);
}

function summarize(faces: Face[], reason: Record<number, Reason>, tree: Tree, settings: Settings, previous: Person[], nextId: { id: number }): SortResult {
  const { groups, confidence } = cutTree(tree, settings);
  const byAnchor = groups.map((g, merged) => ({ merged, faces: [...g].sort((a, b) => a - b) })).sort((a, b) => a.faces[0] - b.faces[0]);
  const ids = assignIds(byAnchor.map((g) => g.faces), previous, nextId);
  const people = byAnchor
    .map((g, i) => ({ ...g, id: ids[i], photos: [...new Set(g.faces.map((fi) => faces[fi].photo))] }))
    .sort((a, b) => a.id - b.id);
  const position: number[] = [];
  const personOf: number[] = [];
  people.forEach((p, pi) => {
    position[p.merged] = pi;
    p.faces.forEach((fi) => (personOf[fi] = pi));
  });
  return {
    faces: faces.slice(),
    people: people.map(({ id, faces, photos }) => ({ id, faces, photos })),
    personOf,
    confidence: confidence.map((c) => ({ ...c, closest: c.closest < 0 ? -1 : position[c.closest] })),
    unsorted: Object.keys(reason).map(Number),
    reason: { ...reason },
    tree,
  };
}

export function regroup(result: SortResult, settings: Settings): SortResult {
  return summarize(result.faces, result.reason, result.tree!, settings, result.people, { id: Math.max(0, ...result.people.map((p) => p.id)) + 1 });
}
