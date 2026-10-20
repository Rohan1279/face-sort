"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { loadEngine, MODELS, type ModelId } from "@/lib/face/engine";
import { download, exportZip } from "@/lib/face/export";
import { sortPhotos, type SortResult } from "@/lib/face/sort";
import { cn } from "@/lib/utils";

export default function Home() {
  const [model, setModel] = useState<ModelId>("sface");
  const [photos, setPhotos] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SortResult | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [showConfidence, setShowConfidence] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function start(files: File[], modelId = model) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    urls.forEach((u) => URL.revokeObjectURL(u));
    setPhotos(images);
    setUrls(images.map((f) => URL.createObjectURL(f)));
    setResult(null);
    setError("");
    setProgress(0);
    try {
      setStatus("Loading face models…");
      const engine = await loadEngine(modelId);
      setStatus(`Finding faces: 0 of ${images.length}`);
      const sorted = await sortPhotos(images, engine, MODELS[modelId], ({ done, total }) => {
        setStatus(done < total ? `Finding faces: ${done + 1} of ${total}` : "Grouping faces…");
        setProgress((done / total) * 100);
      });
      setResult(sorted);
      setNames(sorted.people.map((_, i) => `Person ${i + 1}`));
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
    setNames([]);
    setError("");
  }

  async function exportPhotos() {
    if (!result) return;
    setExporting(true);
    try {
      const people = result.people.map((person, i) => ({ name: names[i], photos: person.photos.map((p) => photos[p]) }));
      download(await exportZip(people, result.unsorted.map((p) => photos[p])), "face-sort.zip");
    } finally {
      setExporting(false);
    }
  }

  const viewed = result && viewing !== null ? result.faces[viewing] : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Face Sort</h1>
        <p className="text-sm text-muted-foreground">Sort photos by the people in them. Everything runs in your browser, so your photos never leave your device.</p>
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!status && (
        <div className="flex items-center gap-2">
          <Label htmlFor="model">Model</Label>
          <Select
            value={model}
            items={Object.fromEntries(Object.entries(MODELS).map(([id, m]) => [id, m.label]))}
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
              {(Object.keys(MODELS) as ModelId[]).map((id) => (
                <SelectItem key={id} value={id}>{MODELS[id].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!photos.length && <DropZone onFiles={start} />}

      {status && (
        <div className="space-y-2">
          <p className="text-sm">{status}</p>
          <Progress value={progress} />
        </div>
      )}

      {result && !status && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="mr-auto text-sm">
              {plural(result.people.length, "person", "people")} in {plural(photos.length, "photo", "photos")}
              {result.unsorted.length > 0 && ` · ${result.unsorted.length} without a recognisable face`}
              {result.failed.length > 0 && ` · ${result.failed.length} couldn't be read`}
            </p>
            <div className="flex items-center gap-2">
              <Switch id="confidence" aria-labelledby="confidence-label" checked={showConfidence} onCheckedChange={setShowConfidence} />
              <Label id="confidence-label" htmlFor="confidence">Show confidence</Label>
            </div>
            <Button onClick={exportPhotos} disabled={exporting}>{exporting ? "Zipping…" : "Download zip"}</Button>
            <Button variant="outline" onClick={reset}>Start over</Button>
          </div>

          {showConfidence && (
            <p className="text-sm text-muted-foreground">
              Dashed amber: hard photo (angle, lighting or blur). Dotted purple: could be someone else; hover a face to see who.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.people.map((person, gi) => (
              <Card key={gi}>
                <CardHeader>
                  <Input aria-label="Person name" value={names[gi]} onChange={(e) => setNames((n) => n.map((v, k) => (k === gi ? e.target.value : v)))} />
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {person.faces.map((fi) => {
                    const face = result.faces[fi];
                    const c = result.confidence[fi];
                    const tip = [
                      photos[face.photo].name,
                      c.fit !== null && `group fit ${c.fit.toFixed(2)}`,
                      c.closest >= 0 && `closest other: ${names[c.closest]}, margin ${c.margin.toFixed(2)}`,
                    ].filter(Boolean).join(" · ");
                    return (
                      <button key={fi} type="button" onClick={() => setViewing(fi)} title={showConfidence ? tip : photos[face.photo].name}>
                        <img
                          src={face.thumb}
                          alt={`Face from ${photos[face.photo].name}`}
                          className={cn(
                            "size-16 rounded-md object-cover",
                            showConfidence && c.lowMargin && "outline-2 -outline-offset-2 outline-dotted outline-purple-500",
                            showConfidence && !c.lowMargin && c.lowFit && "outline-2 -outline-offset-2 outline-dashed outline-amber-500",
                          )}
                        />
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
                <CardContent className="flex flex-wrap gap-2">
                  {result.unsorted.map((p) => (
                    <img key={p} src={urls[p]} alt={photos[p].name} title={photos[p].name} className="size-16 rounded-md object-cover" />
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
                <DialogTitle>{names[result.personOf[viewing!]]}</DialogTitle>
                <DialogDescription>{photos[viewed.photo].name}</DialogDescription>
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
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles([...(e.target.files ?? [])])} />
      </CardContent>
    </Card>
  );
}
