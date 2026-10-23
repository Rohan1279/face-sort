import type { Config, FaceResult, Human } from "@vladmandic/human";
import { alignFace } from "./align";
import type { Settings } from "./grouping.ts";

const HUMAN_MODELS = "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/";

const MODELS = {
  sface: { label: "SFace · Apache-2.0 · 39 MB", file: "/models/sface.onnx", norm: "raw", threshold: 0.42, lowFit: 0.55, lowMargin: 0.05 },
  mbf: { label: "MBF · non-commercial licence · 14 MB", file: "/models/w600k_mbf.onnx", norm: "pm1", threshold: 0.3, lowFit: 0.45, lowMargin: 0.05 },
  r50: { label: "ArcFace R50 · non-commercial licence · 87 MB", file: "/models/w600k_r50.onnx", norm: "pm1", threshold: 0.3, lowFit: 0.45, lowMargin: 0.05 },
} as const;
export type ModelId = keyof typeof MODELS;
export const MODEL_OPTIONS = (Object.keys(MODELS) as ModelId[]).map((id) => ({ id, label: MODELS[id].label }));
export const modelSettings = (id: ModelId): Settings => ({ threshold: MODELS[id].threshold, lowFit: MODELS[id].lowFit, lowMargin: MODELS[id].lowMargin });

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
export type Rejection = { size: number; reason: "small" | "turned" | "unclear" };
export type Engine = { settings: Settings; detect: (file: File) => Promise<{ faces: DetectedFace[]; rejected: Rejection[] }> };

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
    settings: modelSettings(model),
    async detect(file) {
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const result = await human.detect(img);
        const faces: DetectedFace[] = [];
        const rejected: Rejection[] = [];
        for (const f of dropNested(result.face.filter((f) => f.meshRaw?.length))) {
          const reason = rejection(f, img);
          if (reason) rejected.push({ size: f.boxRaw[2] * f.boxRaw[3], reason });
          else faces.push({ embedding: await embed(alignFace(img, f.meshRaw.map(([x, y]) => [x, y]))), thumb: crop(img, f.boxRaw), box: f.boxRaw });
        }
        return { faces, rejected };
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

const rejection = (f: FaceResult, img: HTMLImageElement): Rejection["reason"] | null =>
  f.boxRaw[2] * img.naturalWidth < 40 ? "small" : Math.abs(f.rotation?.angle?.yaw ?? 0) > 0.8 ? "turned" : f.boxScore < 0.6 ? "unclear" : null;

function toTensor(px: Uint8ClampedArray, norm: "raw" | "pm1"): Float32Array {
  const out = new Float32Array(3 * 112 * 112);
  for (let i = 0; i < 112 * 112; i++) {
    for (let c = 0; c < 3; c++) out[c * 12544 + i] = norm === "raw" ? px[i * 4 + c] : (px[i * 4 + c] - 127.5) / 127.5;
  }
  return out;
}

function crop(img: HTMLImageElement, [x, y, w, h]: Box) {
  const [W, H] = [img.naturalWidth, img.naturalHeight];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  canvas.getContext("2d")!.drawImage(img, x * W, y * H, w * W, h * H, 0, 0, 96, 96);
  return canvas.toDataURL("image/jpeg", 0.8);
}
