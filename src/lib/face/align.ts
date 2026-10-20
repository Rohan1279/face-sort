// ArcFace-style alignment: rotate/scale/shift the photo so 5 landmarks land on the standard 112x112 template

type Point = [number, number];

// image-left eye, image-right eye, nose tip, image-left mouth corner, image-right mouth corner
const TEMPLATE: Point[] = [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]];

// the same 5 points from Human's 468-point face mesh (eye centre = midpoint of the eye corners)
const mid = (m: number[][], a: number, b: number): Point => [(m[a][0] + m[b][0]) / 2, (m[a][1] + m[b][1]) / 2];
const landmarks5 = (m: number[][]): Point[] => [mid(m, 33, 133), mid(m, 362, 263), [m[1][0], m[1][1]], [m[61][0], m[61][1]], [m[291][0], m[291][1]]];

// least-squares similarity transform (rotation + uniform scale + shift) mapping src points onto dst
function similarity(src: Point[], dst: Point[]): [number, number, number, number] {
  const n = src.length;
  const ms = [0, 1].map((k) => src.reduce((s, p) => s + p[k], 0) / n);
  const md = [0, 1].map((k) => dst.reduce((s, p) => s + p[k], 0) / n);
  let a = 0, b = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const [sx, sy] = [src[i][0] - ms[0], src[i][1] - ms[1]];
    const [dx, dy] = [dst[i][0] - md[0], dst[i][1] - md[1]];
    a += sx * dx + sy * dy;
    b += sx * dy - sy * dx;
    den += sx * sx + sy * sy;
  }
  a /= den;
  b /= den;
  return [a, b, md[0] - (a * ms[0] - b * ms[1]), md[1] - (b * ms[0] + a * ms[1])];
}

// meshRaw is Human's mesh normalised to 0..1, so it stays correct when Human downscales large photos
export function alignFace(img: HTMLImageElement, meshRaw: number[][]): Uint8ClampedArray {
  const mesh = meshRaw.map(([x, y]) => [x * img.naturalWidth, y * img.naturalHeight]);
  const [a, b, tx, ty] = similarity(landmarks5(mesh), TEMPLATE);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 112;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.setTransform(a, b, -b, a, tx, ty);
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, 112, 112).data;
}

// RGBA pixels -> 1x3x112x112 RGB float tensor; "raw" keeps 0..255 (SFace), "pm1" maps to -1..1 (MBF)
export function toTensor(px: Uint8ClampedArray, norm: "raw" | "pm1"): Float32Array {
  const out = new Float32Array(3 * 112 * 112);
  for (let i = 0; i < 112 * 112; i++) {
    for (let c = 0; c < 3; c++) out[c * 12544 + i] = norm === "raw" ? px[i * 4 + c] : (px[i * 4 + c] - 127.5) / 127.5;
  }
  return out;
}
