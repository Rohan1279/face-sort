import type { Config, FaceResult, Human } from "@vladmandic/human";
import { alignFace, toTensor } from "./align";

const HUMAN_MODELS = "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/";

export const MODELS = {
  sface: { label: "SFace · Apache-2.0 · 39 MB", file: "/models/sface.onnx", norm: "raw", threshold: 0.42, lowFit: 0.55, lowMargin: 0.05 },
  mbf: { label: "MBF · non-commercial licence · 14 MB", file: "/models/w600k_mbf.onnx", norm: "pm1", threshold: 0.3, lowFit: 0.45, lowMargin: 0.05 },
} as const;
export type ModelId = keyof typeof MODELS;

const HUMAN_CONFIG = {
  modelBasePath: HUMAN_MODELS,
  face: {
    detector: { rotation: true, maxDetected: 50, minConfidence: 0.3 },
    description: { enabled: false },
    iris: { enabled: false },
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
} as unknown as Partial<Config>;

export type Box = [number, number, number, number];
export type DetectedFace = { embedding: Float32Array; thumb: string; box: Box };
export type Engine = { detect: (file: File) => Promise<{ faces: DetectedFace[]; skipped: number }> };

let humanReady: Promise<Human> | null = null;
const engines = new Map<ModelId, Promise<Engine>>();

export function loadEngine(model: ModelId) {
  if (!engines.has(model)) engines.set(model, createEngine(model).catch((e) => (engines.delete(model), Promise.reject(e))));
  return engines.get(model)!;
}

async function loadHuman() {
  const { Human } = await import("@vladmandic/human");
  const human = new Human(HUMAN_CONFIG);
  await human.load();
  await human.warmup();
  return human;
}

async function createEngine(model: ModelId): Promise<Engine> {
  const { file, norm } = MODELS[model];
  const [human, ort] = await Promise.all([(humanReady ??= loadHuman()), import("onnxruntime-web/webgpu")]);
  ort.env.logLevel = "error";

  const session = await ort.InferenceSession.create(file, { executionProviders: ["webgpu", "wasm"], logSeverityLevel: 3 });
  const embed = async (px: Uint8ClampedArray) => {
    const out = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", toTensor(px, norm), [1, 3, 112, 112]) });
    return out[session.outputNames[0]].data as Float32Array;
  };
  await embed(new Uint8ClampedArray(112 * 112 * 4));

  return {
    async detect(file) {
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const result = await human.detect(img);
        const detected = dropNested(result.face.filter((f) => f.meshRaw?.length));
        const found = detected.filter((f) => goodQuality(f, img));
        const faces: DetectedFace[] = [];
        for (const f of found) faces.push({ embedding: await embed(alignFace(img, f.meshRaw.map(([x, y]) => [x, y]))), thumb: crop(img, f.boxRaw), box: f.boxRaw });
        return { faces, skipped: detected.length - found.length };
      } finally {
        URL.revokeObjectURL(url);
      }
    },
  };
}

function dropNested(list: FaceResult[]) {
  const area = ([, , w, h]: Box) => w * h;
  const overlap = ([ax, ay, aw, ah]: Box, [bx, by, bw, bh]: Box) =>
    Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx)) * Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  return list.filter((a) => !list.some((b) => b !== a && b.boxScore > a.boxScore && overlap(a.box, b.box) > 0.6 * Math.min(area(a.box), area(b.box))));
}

const goodQuality = (f: FaceResult, img: HTMLImageElement) =>
  f.boxScore >= 0.6 && Math.abs(f.rotation?.angle?.yaw ?? 0) <= 0.8 && f.boxRaw[2] * img.naturalWidth >= 40;

function crop(img: HTMLImageElement, [x, y, w, h]: Box) {
  const [W, H] = [img.naturalWidth, img.naturalHeight];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  canvas.getContext("2d")!.drawImage(img, x * W, y * H, w * W, h * H, 0, 0, 96, 96);
  return canvas.toDataURL("image/jpeg", 0.8);
}
