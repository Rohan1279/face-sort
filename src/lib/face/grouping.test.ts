import assert from "node:assert/strict";
import { test } from "node:test";
import { cluster, confidence, similarityMatrix } from "./grouping.ts";

const SFACE = { threshold: 0.42, lowFit: 0.55, lowMargin: 0.05 };

// two "people" (directions A and B) with small per-photo noise
const A = [1, 0, 0, 0];
const B = [0, 1, 0, 0];
const near = (v: number[], k: number) => v.map((x, i) => x + (i === k ? 0.2 : 0));

test("groups each person together and keeps people apart", () => {
  const embeddings = [near(A, 2), near(A, 3), near(B, 2), near(B, 3), near(A, 1)];
  const groups = cluster(similarityMatrix(embeddings, [0, 1, 2, 3, 4]), SFACE.threshold);
  assert.deepEqual(groups.map((g) => [...g].sort()), [[0, 1, 4], [2, 3]]);
});

test("two faces from the same photo never share a group", () => {
  const embeddings = [near(A, 2), near(A, 3)];
  assert.equal(cluster(similarityMatrix(embeddings, [0, 0]), SFACE.threshold).length, 2);
});

test("a face halfway between two people gets a low margin pointing at the other group", () => {
  const embeddings = [near(A, 2), near(A, 3), near(B, 2), near(B, 3), [0.7, 0.69, 0, 0]];
  const sims = similarityMatrix(embeddings, [0, 1, 2, 3, 4]);
  const groups = cluster(sims, SFACE.threshold);
  const conf = confidence(groups, sims, SFACE);
  assert.ok(conf[4].lowMargin);
  assert.ok(!conf[0].lowMargin && !conf[0].lowFit);
  assert.notEqual(conf[4].closest, groups.findIndex((g) => g.includes(4)));
});
