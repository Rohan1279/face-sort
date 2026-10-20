import assert from "node:assert/strict";
import { test } from "node:test";
import { groupFaces } from "./grouping.ts";

const SFACE = { threshold: 0.42, lowFit: 0.55, lowMargin: 0.05 };

const A = [1, 0, 0, 0];
const B = [0, 1, 0, 0];
const near = (v: number[], k: number) => v.map((x, i) => x + (i === k ? 0.2 : 0));
const onePhotoEach = (embeddings: number[][]) => embeddings.map((embedding, photo) => ({ embedding, photo }));

test("groups each person together and keeps people apart", () => {
  const { groups } = groupFaces(onePhotoEach([near(A, 2), near(A, 3), near(B, 2), near(B, 3), near(A, 1)]), SFACE);
  assert.deepEqual(groups.map((g) => [...g].sort()), [[0, 1, 4], [2, 3]]);
});

test("two faces from the same photo never share a group", () => {
  const { groups } = groupFaces([{ embedding: near(A, 2), photo: 0 }, { embedding: near(A, 3), photo: 0 }], SFACE);
  assert.equal(groups.length, 2);
});

test("a face halfway between two people gets a low margin pointing at the other group", () => {
  const { groupOf, confidence } = groupFaces(onePhotoEach([near(A, 2), near(A, 3), near(B, 2), near(B, 3), [0.7, 0.69, 0, 0]]), SFACE);
  assert.ok(confidence[4].lowMargin);
  assert.ok(!confidence[0].lowMargin && !confidence[0].lowFit);
  assert.notEqual(confidence[4].closest, groupOf[4]);
});
