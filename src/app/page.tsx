"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadEngine, MODEL_OPTIONS, modelSettings, type ModelId } from "@/lib/face/engine";
import { download, exportZip } from "@/lib/face/export";
import { regroup, sortPhotos, type Reason, type SortResult } from "@/lib/face/sort";
import { cn } from "@/lib/utils";

export default function Home() {
  const [model, setModel] = useState<ModelId>("sface");
  const [photos, setPhotos] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SortResult | null>(null);
  const [names, setNames] = useState<Record<number, string>>({});
  const [threshold, setThreshold] = useState(() => modelSettings(model).threshold);
  const [viewing, setViewing] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    loadEngine(model).catch(() => {});
  }, [model]);

  useLayoutEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-slot=card-content]").forEach((el) => (el.scrollTop = el.scrollHeight));
  }, [result]);

  async function start(files: File[], modelId = model) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    urls.forEach((u) => URL.revokeObjectURL(u));
    setPhotos(images);
    setUrls(images.map((f) => URL.createObjectURL(f)));
    setResult(null);
    setNames({});
    setThreshold(modelSettings(modelId).threshold);
    setError("");
    setProgress(0);
    try {
      setStatus("Loading face models…");
      const engine = await loadEngine(modelId);
      setStatus(`Finding faces: 0 of ${images.length}`);
      const sorted = await sortPhotos(images, engine, ({ done, total, result }) => {
        setStatus(`Finding faces: ${Math.min(done + 1, total)} of ${total}`);
        setProgress((done / total) * 100);
        if (result) setResult(result);
      });
      setResult(sorted);
    } catch (e) {
      setError(`Something went wrong: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setStatus("");
    }
  }

  function reset() {
    urls.forEach((u) => URL.revokeObjectURL(u));
    setPhotos([]);
    setUrls([]);
    setResult(null);
    setNames({});
    setError("");
  }

  async function exportPhotos() {
    if (!result) return;
    setExporting(true);
    try {
      const people = result.people.map((person, i) => ({ name: nameOf(i), photos: person.photos.map((p) => photos[p]) }));
      download(await exportZip(people, result.unsorted.map((p) => photos[p])), "face-sort.zip");
    } finally {
      setExporting(false);
    }
  }

  function changeThreshold(value: number) {
    setThreshold(value);
    if (result) setResult(regroup(result, { ...modelSettings(model), threshold: value }));
  }

  const nameOf = (pi: number) => {
    const { id } = result!.people[pi];
    return names[id] ?? `Person ${id}`;
  };
  const viewed = result && viewing !== null ? result.faces[viewing] : null;
  const doubt = (fi: number) => {
    const c = result!.confidence[fi];
    return status ? "" : c.lowMargin ? `Might be ${nameOf(c.closest)}` : c.lowFit ? "Hard to see: angle, lighting or blur" : "";
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <h1 className="sr-only">Face Sort</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Label htmlFor="model">Model</Label>
        <Select
          disabled={!!status}
          value={model}
          items={MODEL_OPTIONS.map(({ id, label }) => ({ value: id, label }))}
          onValueChange={(value) => {
            if (!value) return;
            const next = value as ModelId;
            setModel(next);
            if (photos.length) start(photos, next);
          }}
        >
          <SelectTrigger id="model" className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map(({ id, label }) => (
              <SelectItem key={id} value={id}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!photos.length && <DropZone onFiles={start} />}

      {status && (
        <div className="space-y-2">
          <p className="text-sm">{status}</p>
          <Progress value={progress} />
        </div>
      )}

      {result && (
        <>
          {!status && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="mr-auto text-sm">
                {plural(result.people.length, "person", "people")} in {plural(photos.length, "photo", "photos")}
              </p>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Looser
                <input type="range" aria-label="Match strictness" min={0.1} max={0.7} step={0.01} value={threshold} onChange={(e) => changeThreshold(+e.target.value)} className="w-32 accent-primary" />
                Stricter
                <span className="w-8 text-foreground tabular-nums">{threshold.toFixed(2)}</span>
              </label>
              <Button onClick={exportPhotos} disabled={exporting}>{exporting ? "Zipping…" : "Download zip"}</Button>
              <Button variant="outline" onClick={reset}>Start over</Button>
            </div>
          )}

          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.people.map((person, gi) => (
              <Card key={person.id}>
                <CardHeader>
                  <Input aria-label="Person name" disabled={!!status} value={nameOf(gi)} onChange={(e) => setNames((n) => ({ ...n, [person.id]: e.target.value }))} />
                </CardHeader>
                <CardContent className={cn("flex max-h-72 flex-wrap gap-2 pt-1", status ? "overflow-hidden" : "overflow-y-auto")}>
                  {person.faces.map((fi) => {
                    const face = result.faces[fi];
                    const note = doubt(fi);
                    return (
                      <button key={fi} type="button" className="relative" onClick={() => setViewing(fi)} title={[photos[face.photo].name, note].filter(Boolean).join(" · ")}>
                        <img src={face.thumb} alt={`Face from ${photos[face.photo].name}`} className="size-16 rounded-md object-cover" />
                        {note && (
                          <span role="img" aria-label={note} className="absolute -top-1 -right-1 grid motion-safe:animate-in fade-in-0 duration-150 size-5 place-items-center rounded-full bg-amber-500 text-xs font-semibold text-white">?</span>
                        )}
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
            {result.unsorted.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Unsorted</CardTitle>
                </CardHeader>
                <CardContent className={cn("flex max-h-72 flex-wrap gap-2 pt-1", status ? "overflow-hidden" : "overflow-y-auto")}>
                  {result.unsorted.map((p) => (
                    <figure key={p} className="w-16">
                      <img src={urls[p]} alt={photos[p].name} title={photos[p].name} className="size-16 rounded-md object-cover" />
                      <figcaption className="mt-1 text-xs text-muted-foreground">{REASONS[result.reason[p]]}</figcaption>
                    </figure>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      <Dialog open={!!viewed} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-3xl">
          {viewed && result && (
            <>
              <DialogHeader>
                <DialogTitle>{nameOf(result.personOf[viewing!])}</DialogTitle>
                <DialogDescription>{[photos[viewed.photo].name, doubt(viewing!)].filter(Boolean).join(" · ")}</DialogDescription>
              </DialogHeader>
              <div className="relative mx-auto w-fit">
                <img src={urls[viewed.photo]} alt={photos[viewed.photo].name} className="max-h-[70vh] w-auto" />
                <div
                  className="absolute rounded-sm border-2 border-green-500"
                  style={{ left: `${viewed.box[0] * 100}%`, top: `${viewed.box[1] * 100}%`, width: `${viewed.box[2] * 100}%`, height: `${viewed.box[3] * 100}%` }}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const REASONS: Record<Reason, string> = {
  none: "No face found",
  small: "Face too small",
  turned: "Face turned away",
  unclear: "Face unclear: blurry, dark or covered",
  unreadable: "Couldn't open this file",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <Card
      className={cn("border-dashed", over && "border-primary")}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles([...e.dataTransfer.files]);
      }}
    >
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <p>Drop photos here</p>
        <Button onClick={() => input.current?.click()}>Choose photos</Button>
        <p className="text-xs text-muted-foreground">Everything runs in your browser, so your photos never leave your device.</p>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles([...(e.target.files ?? [])])} />
      </CardContent>
    </Card>
  );
}
