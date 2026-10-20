import assert from "node:assert/strict";
import { test } from "node:test";
import type { DetectedFace, Engine } from "./engine";
import { sortPhotos } from "./sort.ts";


const A = [1, 0, 0, 0];
const B = [0, 1, 0, 0];
const face = (v: number[], k: number): DetectedFace => ({ embedding: Float32Array.from(v.map((x, i) => x + (i === k ? 0.2 : 0))), thumb: "", box: [0, 0, 1, 1] });

const facesIn: Record<string, DetectedFace[]> = {
  "a1.jpg": [face(A, 2)],
  "a2.jpg": [face(A, 3)],
  "group.jpg": [face(A, 1), face(B, 2)],
  "b1.jpg": [face(B, 3)],
  "landscape.jpg": [],
};
const fakeEngine: Engine = {
  settings: { threshold: 0.42, lowFit: 0.55, lowMargin: 0.05 },
  async detect(file) {
    if (!(file.name in facesIn)) throw new Error("cannot decode");
    return facesIn[file.name];
  },
};

const photos = ["a1.jpg", "a2.jpg", "group.jpg", "b1.jpg", "landscape.jpg", "broken.jpg"].map((n) => new File([], n));
const progress: { done: number; total: number }[] = [];
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
  assert.deepEqual(result.unsorted, [4, 5]);
});

test("an unreadable photo goes to failed and the run carries on", () => {
  assert.deepEqual(result.failed, [5]);
  assert.equal(result.faces.length, 5);
});

test("progress is reported once per photo", () => {
  assert.deepEqual(progress.map((p) => p.done), [1, 2, 3, 4, 5, 6]);
  assert.ok(progress.every((p) => p.total === 6));
});
