import type { DetectedFace, Engine } from "./engine";
import { groupFaces, type Confidence } from "./grouping.ts";

export type Face = DetectedFace & { photo: number };
export type Person = { faces: number[]; photos: number[] };
export type SortResult = {
  faces: Face[];
  people: Person[];
  personOf: number[];
  confidence: Confidence[];
  unsorted: number[];
  failed: number[];
};

export async function sortPhotos(
  photos: File[],
  engine: Engine,
  onProgress: (progress: { done: number; total: number }) => void = () => {},
): Promise<SortResult> {
  const faces: Face[] = [];
  const failed: number[] = [];
  for (const [i, photo] of photos.entries()) {
    try {
      faces.push(...(await engine.detect(photo)).map((f) => ({ ...f, photo: i })));
    } catch {
      failed.push(i);
    }
    onProgress({ done: i + 1, total: photos.length });
  }
  await new Promise((r) => setTimeout(r));
  const { groups, groupOf, confidence } = groupFaces(faces, engine.settings);
  const withFaces = new Set(faces.map((f) => f.photo));
  return {
    faces,
    people: groups.map((g) => ({ faces: g, photos: [...new Set(g.map((fi) => faces[fi].photo))] })),
    personOf: groupOf,
    confidence,
    unsorted: photos.map((_, i) => i).filter((i) => !withFaces.has(i)),
    failed,
  };
}
