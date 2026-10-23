import assert from "node:assert/strict";
import { test } from "node:test";
import type { DetectedFace, Engine, Rejection } from "./engine";
import { assignIds, regroup, sortPhotos, type SortResult } from "./sort.ts";


const A = [1, 0, 0, 0];
const B = [0, 1, 0, 0];
const face = (v: number[], k: number): DetectedFace => ({ embedding: Float32Array.from(v.map((x, i) => x + (i === k ? 0.2 : 0))), thumb: "", box: [0, 0, 1, 1] });

const facesIn: Record<string, DetectedFace[]> = {
  "a1.jpg": [face(A, 2)],
  "a2.jpg": [face(A, 3)],
  "group.jpg": [face(A, 1), face(B, 2)],
  "b1.jpg": [face(B, 3)],
  "landscape.jpg": [],
  "crowd.jpg": [],
};
const rejectedIn: Record<string, Rejection[]> = {
  "crowd.jpg": [{ size: 0.01, reason: "small" }, { size: 0.2, reason: "turned" }, { size: 0.05, reason: "unclear" }],
};
const fakeEngine: Engine = {
  settings: { threshold: 0.42, lowFit: 0.55, lowMargin: 0.05 },
  async detect(file) {
    if (!(file.name in facesIn)) throw new Error("cannot decode");
    return { faces: facesIn[file.name], rejected: rejectedIn[file.name] ?? [] };
  },
};

const photos = ["a1.jpg", "a2.jpg", "group.jpg", "b1.jpg", "landscape.jpg", "broken.jpg", "crowd.jpg"].map((n) => new File([], n));
const progress: { done: number; total: number; result?: SortResult }[] = [];
const result = await sortPhotos(photos, fakeEngine, (p) => progress.push(p));
const personWith = (photo: number) => result.people.find((p) => p.photos.includes(photo));

test("one person across several photos ends up as one person", () => {
  assert.equal(result.people.length, 2);
  assert.deepEqual([...personWith(0)!.photos].sort(), [0, 1, 2]);
  assert.deepEqual([...personWith(3)!.photos].sort(), [2, 3]);
});

test("a group photo appears in every person's photos", () => {
  assert.ok(result.people.every((p) => p.photos.includes(2)));
});

test("photos without a usable face go to unsorted", () => {
  assert.deepEqual(result.unsorted, [4, 5, 6]);
});

test("each unsorted photo says why, using its largest rejected face", () => {
  assert.deepEqual(result.reason, { 4: "none", 5: "unreadable", 6: "turned" });
  assert.equal(result.faces.length, 5);
});

test("the first photo streams a partial result", () => {
  assert.equal(progress[0].result?.faces.length, 1);
});

test("while streaming, a new face joins the person it matches", () => {
  assert.deepEqual(progress[1].result?.people, [{ id: 1, faces: [0, 1], photos: [0, 1] }]);
});

test("progress is reported once per photo", () => {
  assert.deepEqual(progress.map((p) => p.done), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(progress.every((p) => p.total === 7));
});

test("faces inside a person stay in upload order", () => {
  assert.ok(result.people.every((p) => p.faces.every((f, i) => i === 0 || p.faces[i - 1] < f)));
});

test("people are ordered by id, while streaming and at the end", () => {
  const all = [...progress.flatMap((p) => (p.result ? [p.result] : [])), result];
  assert.ok(all.length > 1);
  assert.ok(all.every((r) => r.people.every((p, i) => i === 0 || r.people[i - 1].id < p.id)));
});

test("after a split, the bigger half keeps the id", () => {
  const nextId = { id: 2 };
  assert.deepEqual(assignIds([[0], [1, 2, 3]], [{ id: 1, faces: [0, 1, 2, 3], photos: [] }], nextId), [2, 1]);
});

test("after a merge, the id with more faces wins", () => {
  const people = [{ id: 1, faces: [0, 1], photos: [] }, { id: 2, faces: [2, 3, 4], photos: [] }];
  assert.deepEqual(assignIds([[0, 1, 2, 3, 4]], people, { id: 3 }), [2]);
});

test("regrouping keeps people and ids, and a stricter threshold splits them", () => {
  assert.deepEqual(regroup(result, fakeEngine.settings).people, result.people);
  assert.equal(regroup(result, { ...fakeEngine.settings, threshold: 0.999 }).people.length, result.faces.length);
});
