const converted = new WeakMap<File, Promise<File>>();

export const isHeic = (file: File) => /^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);

export function viewable(file: File): Promise<File> {
  if (!isHeic(file)) return Promise.resolve(file);
  let jpeg = converted.get(file);
  if (!jpeg) {
    jpeg = import("heic-to/next")
      .then(({ heicTo }) => heicTo({ blob: file, type: "image/jpeg", quality: 0.9 }))
      .then((blob) => new File([blob], file.name.replace(/\.hei[cf]$/i, ".jpg"), { type: "image/jpeg" }))
      .catch(() => file);
    converted.set(file, jpeg);
  }
  return jpeg;
}
