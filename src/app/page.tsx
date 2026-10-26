"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Download, ImageOff, ImagePlus, PencilLine, ScanFace, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { loadEngine, MODEL_OPTIONS, modelSettings, type ModelId } from "@/lib/face/engine";
import { download, exportZip } from "@/lib/face/export";
import { isHeic, viewable } from "@/lib/face/heic";
import { moveFace, regroup, sortPhotos, type Reason, type SortResult } from "@/lib/face/sort";
import { cn } from "@/lib/utils";

const PEEK = 8;
const UNSORTED = -1;
const iconButton = buttonVariants({ variant: "ghost", size: "icon-lg" });
const SCROLL_EDGE = 72;

export default function Home() {
  const [model, setModel] = useState<ModelId>("sface");
  const [photos, setPhotos] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SortResult | null>(null);
  const [names, setNames] = useState<Record<number, string>>({});
  const [threshold, setThreshold] = useState(() => modelSettings(model).threshold);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [onlyChecks, setOnlyChecks] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    if (dragging === null) return;
    let y: number | null = null;
    let frame = 0;
    const track = (e: DragEvent) => (y = e.clientY);
    const step = () => {
      if (y !== null) {
        const top = (header.current?.getBoundingClientRect().bottom ?? 0) + SCROLL_EDGE;
        const bottom = innerHeight - SCROLL_EDGE;
        const push = y < top ? y - top : y > bottom ? y - bottom : 0;
        if (push) scrollBy(0, Math.max(-SCROLL_EDGE, Math.min(SCROLL_EDGE, push)) / 3);
      }
      frame = requestAnimationFrame(step);
    };
    document.addEventListener("dragover", track);
    frame = requestAnimationFrame(step);
    return () => {
      document.removeEventListener("dragover", track);
      cancelAnimationFrame(frame);
    };
  }, [dragging]);
  useEffect(() => {
    loadEngine(model).catch(() => {});
  }, [model]);

  async function start(files: File[], modelId = model) {
    const images = files.filter((f) => f.type.startsWith("image/") || isHeic(f));
    if (!images.length) return;
    urls.forEach((u) => URL.revokeObjectURL(u));
    setPhotos(images);
    setUrls([]);
    setResult(null);
    setNames({});
    setOpen(new Set());
    setOnlyChecks(false);
    setThreshold(modelSettings(modelId).threshold);
    setError("");
    setProgress(0);
    try {
      if (images.some(isHeic)) setStatus("Converting HEIC photos…");
      const decoded = await Promise.all(images.map(viewable));
      setUrls(decoded.map((f) => URL.createObjectURL(f)));
      setStatus("Loading face models…");
      const engine = await loadEngine(modelId);
      setStatus(`Finding faces: 0 of ${images.length}`);
      const sorted = await sortPhotos(decoded, engine, ({ done, total, result }) => {
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

  const keepCurrent = () => !!result && !confirm("Replace the current people with a new set of photos? Names and moves you made will be lost.");

  function addPhotos(files: File[]) {
    if (!keepCurrent()) start(files);
  }

  function reset() {
    if (keepCurrent()) return;
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

  async function exportPerson(pi: number) {
    const name = nameOf(pi);
    download(await exportZip([{ name, photos: result!.people[pi].photos.map((p) => photos[p]) }], []), `${name}.zip`);
  }

  function changeModel(next: ModelId) {
    setModel(next);
    if (photos.length) start(photos, next);
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
    return status || !c ? "" : c.lowMargin ? `Might be ${nameOf(c.closest)}` : c.lowFit ? "Hard to see: angle, lighting or blur" : "";
  };
  const checks = (faces: number[]) => faces.filter((fi) => doubt(fi)).length;
  const score = (fi: number) => {
    const c = result!.confidence[fi];
    return c ? (c.fit ?? 0) - (c.lowFit || c.lowMargin ? 1 : 0) : 0;
  };
  const best = (faces: number[]) => faces.reduce((b, fi) => (score(fi) > score(b) ? fi : b));
  const toggle = (id: number) => setOpen((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set(s).add(id)));

  const people = result?.people ?? [];
  const unsorted = result?.unsorted ?? [];
  const toCheck = people.reduce((n, p) => n + checks(p.faces), 0);
  const filtering = onlyChecks && toCheck > 0;
  const listed = people.map((person, pi) => ({ person, pi })).filter(({ person }) => !filtering || checks(person.faces) > 0);
  const anyOpen = open.size > 0;
  const summary = result && `${plural(people.length, "person", "people")} in ${plural(photos.length, "photo", "photos")}`;

  const dropOn = (pi: number) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("text/x-face")) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setOver(pi);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
    },
    onDrop: (e: React.DragEvent) => {
      const fi = e.dataTransfer.getData("text/x-face");
      if (!fi) return;
      e.preventDefault();
      e.stopPropagation();
      setOver(null);
      setDragging(null);
      if (result) setResult(moveFace(result, +fi, pi));
    },
  });

  const face = (fi: number) => {
    const f = result!.faces[fi];
    const note = doubt(fi);
    return (
      <li key={fi} className="shrink-0">
        <button
          type="button"
          draggable={!status}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/x-face", String(fi));
            e.dataTransfer.effectAllowed = "move";
            setDragging(fi);
          }}
          onDragEnd={() => {
            setDragging(null);
            setOver(null);
          }}
          onClick={() => setViewing(fi)}
          title={note || photos[f.photo].name}
          className={cn("print relative block p-0.5", !status && "cursor-grab active:cursor-grabbing", dragging === fi && "opacity-40")}
        >
          <img src={f.thumb} alt={`Face from ${photos[f.photo].name}`} draggable={false} className="size-12 rounded-[5px] object-cover" />
          {note && <span role="img" aria-label={note} className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-cotton text-xs font-semibold ring-1 ring-ink">?</span>}
        </button>
      </li>
    );
  };

  const strip = (id: number, items: React.ReactNode[]) => {
    const isOpen = open.has(id);
    const more = items.length - PEEK;
    return (
      <ul className={cn("flex gap-2 py-2.5", isOpen ? "flex-wrap" : "overflow-x-auto pr-2 scrollbar-none", !isOpen && items.length > 5 && "max-sm:mask-[linear-gradient(to_right,black_85%,transparent)]")}>
        {isOpen ? items : items.slice(0, PEEK)}
        {more > 0 && (
          <li className="shrink-0">
            <button type="button" aria-expanded={isOpen} onClick={() => toggle(id)} className="grid h-13 min-w-13 place-items-center rounded-md bg-paper-3 px-2 font-outlier text-xs text-ink-2 hover:bg-rule">
              {isOpen ? "Less" : `+${more}`}
            </button>
          </li>
        )}
      </ul>
    );
  };

  return (
    <div
      className={cn("min-h-dvh", fileOver && "bg-paper-2")}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setFileOver(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setFileOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setFileOver(false);
        addPhotos([...e.dataTransfer.files]);
      }}
    >
      <header ref={header} className="sticky top-0 z-10 border-b bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-2 sm:flex-nowrap">
          <h1 className="mr-auto flex shrink-0 items-center gap-2 pr-3 text-md font-semibold tracking-tight sm:mr-0">
            <ScanFace aria-hidden className="size-5" />
            <span className="max-[380px]:sr-only">Face Sort</span>
          </h1>
          <p aria-live="polite" className="order-last w-full truncate text-sm text-ink-3 max-sm:empty:hidden sm:order-0 sm:mr-auto sm:w-auto sm:min-w-0">
            {dragging !== null ? "Drop the face on the person it belongs to" : status || summary}
          </p>
          {toCheck > 0 && !status && (
            <button type="button" aria-pressed={filtering} onClick={() => setOnlyChecks(!onlyChecks)} title={filtering ? "Show everyone" : "Show only people with faces to check"} className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "gap-2", filtering && "bg-paper-3")}>
              <span aria-hidden className="grid size-5 place-items-center rounded-full bg-cotton text-xs font-semibold ring-1 ring-ink">?</span>
              <span className="font-outlier text-xs">{toCheck}</span>
              <span className="max-sm:sr-only">to check</span>
            </button>
          )}
          {people.length > 0 && (
            <button type="button" aria-label={anyOpen ? "Collapse all" : "Expand all"} title={anyOpen ? "Collapse all" : "Expand all"} onClick={() => setOpen(anyOpen ? new Set() : new Set([...people.map((p) => p.id), UNSORTED]))} className={cn(iconButton, "max-sm:hidden")}>
              {anyOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
            </button>
          )}
          {photos.length > 0 && !status && (
            <button type="button" aria-label="Sort new photos" title="Sort new photos" onClick={() => !keepCurrent() && picker.current?.click()} className={iconButton}>
              <ImagePlus />
            </button>
          )}
          <button type="button" popoverTarget="settings" aria-label="Settings" title="Settings" className={cn(iconButton, "settings-anchor")}>
            <SlidersHorizontal />
          </button>
          {result && !status && (
            <Button size="lg" onClick={exportPhotos} disabled={exporting} title="Download every person as folders in one zip" className="ml-1">
              <Download />
              <span className="max-sm:sr-only">{exporting ? "Zipping…" : "Download all"}</span>
            </Button>
          )}
        </div>
        {status && <Progress value={progress} className="absolute inset-x-0 -bottom-px" />}
      </header>
      <input ref={picker} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => {
        start([...(e.target.files ?? [])]);
        e.target.value = "";
      }} />

      <div id="settings" popover="auto" className="settings p-4 text-sm">
        <fieldset disabled={!!status}>
          <legend className="mb-2 font-medium">Recognition model</legend>
          {MODEL_OPTIONS.map(({ id, label }) => {
            const [title, ...details] = label.split(" · ");
            return (
              <label key={id} className="flex cursor-pointer gap-3 rounded-md p-2 hover:bg-paper-2 has-checked:bg-paper-2 has-disabled:cursor-not-allowed has-disabled:opacity-60">
                <input type="radio" name="model" value={id} checked={model === id} onChange={() => changeModel(id)} className="mt-1 accent-ink" />
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-xs text-ink-3">{details.join(", ")}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <label className="mt-3 block border-t pt-4">
          <span className="font-medium">Match strictness</span>
          <span className="mt-2 flex items-center gap-2 text-ink-3">
            Looser
            <input type="range" aria-label="Match strictness" min={0.1} max={0.7} step={0.01} value={threshold} disabled={!result || !!status} onChange={(e) => changeThreshold(+e.target.value)} className="min-w-0 flex-1 accent-ink disabled:opacity-50" />
            Stricter
            <span className="w-9 text-right font-outlier text-ink tabular-nums">{threshold.toFixed(2)}</span>
          </span>
        </label>
        {photos.length > 0 && !status && (
          <div className="mt-4 border-t pt-3">
            <Button variant="ghost" className="-mx-2 text-ink-3 hover:text-destructive" onClick={reset}>
              <Trash2 />
              Clear all photos
            </Button>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-24">
        {error && <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-cotton px-3 py-2 text-sm text-destructive">{error}</p>}

        {!photos.length && (
          <div className={cn("mt-8 grid place-items-center gap-4 rounded-card border border-dashed border-rule-2 bg-desk px-6 py-24 text-center", fileOver && "border-ink bg-paper-3")}>
            <ImagePlus aria-hidden className="size-8 text-ink-3" />
            <h2 className="text-2xl">Drop photos here</h2>
            <Button size="lg" onClick={() => picker.current?.click()}>Choose photos</Button>
            <p className="max-w-[40ch] text-sm text-ink-3">Everything runs in your browser, so your photos never leave your device.</p>
          </div>
        )}

        {photos.length > 0 && !people.length && !unsorted.length && status && (
          <ul aria-hidden className="divide-y">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 py-4">
                <span className="size-14 rounded-md bg-paper-3 motion-safe:animate-pulse" />
                <span className="h-4 w-32 rounded-sm bg-paper-3 motion-safe:animate-pulse" />
              </li>
            ))}
          </ul>
        )}

        <div className="divide-y">
          {listed.map(({ person, pi }) => {
            const n = checks(person.faces);
            const isTarget = dragging !== null && result!.personOf[dragging] !== pi;
            return (
              <article
                key={person.id}
                {...dropOn(pi)}
                className={cn(
                  "grid gap-x-6 gap-y-2 rounded-md py-3 outline-offset-2 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-center",
                  isTarget && "outline-1 outline-rule-2 outline-dashed",
                  over === pi && "bg-paper-2 outline-2 outline-focus outline-solid",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <img src={result!.faces[best(person.faces)].thumb} alt="" className="print size-14 shrink-0 object-cover p-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="group relative w-fit max-w-full">
                      <Input aria-label="Person name" disabled={!!status} value={nameOf(pi)} onChange={(e) => setNames((s) => ({ ...s, [person.id]: e.target.value }))} className="h-8 w-auto max-w-full min-w-28 border-transparent bg-transparent pr-8 font-semibold field-sizing-content hover:border-input disabled:bg-transparent disabled:opacity-100 md:text-md" />
                      <PencilLine aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-3 group-focus-within:text-ink group-hover:text-ink" />
                    </div>
                    <p className="px-2.5 text-xs text-ink-3">
                      {plural(person.photos.length, "photo", "photos")}
                      {n > 0 && `, ${n} to check`}
                    </p>
                  </div>
                  <button type="button" aria-label={`Download ${nameOf(pi)}`} title={`Download ${nameOf(pi)}`} disabled={!!status} onClick={() => exportPerson(pi)} className={buttonVariants({ variant: "ghost", size: "icon" })}>
                    <Download />
                  </button>
                </div>
                {strip(person.id, person.faces.map(face))}
              </article>
            );
          })}

          {unsorted.length > 0 && !filtering && (
            <section className="grid gap-x-6 gap-y-2 py-3 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start">
              <div className="flex items-center gap-3">
                <span className="grid size-14 shrink-0 place-items-center rounded-md border border-dashed border-rule-2 text-ink-3">
                  <ImageOff aria-hidden className="size-5" />
                </span>
                <div>
                  <h2 className="px-2.5 text-md">Unsorted</h2>
                  <p className="px-2.5 text-xs text-ink-3">{plural(unsorted.length, "photo", "photos")} without a face to sort</p>
                </div>
              </div>
              {strip(
                UNSORTED,
                unsorted.map((i) => (
                  <li key={i} className="w-20 shrink-0">
                    <img src={urls[i]} alt={photos[i].name} title={photos[i].name} className="print size-20 object-cover p-0.5" />
                    <p className="mt-1 text-xs text-ink-3">{REASONS[result!.reason[i]]}</p>
                  </li>
                )),
              )}
            </section>
          )}
        </div>
      </div>

      <Dialog open={!!viewed} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-3xl">
          {viewed && result && (
            <>
              <DialogHeader>
                <DialogTitle>{nameOf(result.personOf[viewing!])}</DialogTitle>
                <DialogDescription>
                  {photos[viewed.photo].name}
                  {doubt(viewing!) && <span className="block">{doubt(viewing!)}</span>}
                </DialogDescription>
              </DialogHeader>
              <div className="relative mx-auto w-fit">
                <img src={urls[viewed.photo]} alt={photos[viewed.photo].name} className="max-h-[70vh] w-auto" />
                <div
                  className="absolute rounded-sm border-2 border-focus"
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
