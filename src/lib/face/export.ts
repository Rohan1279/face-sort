import { zip, type Zippable } from "fflate";

export async function exportZip(people: { name: string; photos: File[] }[], unsorted: File[]): Promise<Blob> {
  const tree: Zippable = {};
  const folders = [...people, { name: "Unsorted", photos: unsorted }].filter((p) => p.photos.length);
  for (const { name, photos } of folders) {
    const folder: Zippable = {};
    for (const file of photos) folder[unique(folder, file.name)] = [new Uint8Array(await file.arrayBuffer()), { level: 0 }];
    tree[unique(tree, safeName(name) || "Person")] = folder;
  }
  const data = await new Promise<Uint8Array>((resolve, reject) => zip(tree, (err, out) => (err ? reject(err) : resolve(out))));
  return new Blob([data as BlobPart], { type: "application/zip" });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safeName = (name: string) => name.replace(/[\\/:*?"<>|]/g, "").trim();

function unique(taken: object, name: string) {
  const dot = name.lastIndexOf(".");
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  let candidate = name;
  for (let i = 2; candidate in taken; i++) candidate = `${base} (${i})${ext}`;
  return candidate;
}
