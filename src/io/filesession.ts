/**
 * The drawing and its file, working together.
 *
 * `DiskFile` moves text; this decides when. It is where the rules live that
 * keep an autosave from doing damage:
 *
 * - edits are written a moment after they stop, never in the middle of a drag;
 * - a file changed from outside is never overwritten by an autosave — the
 *   writing stops, the Reload button lights up, and the person decides;
 * - a drawing that stops being the file's (new, sample) is unlinked first, or
 *   the next autosave would replace the file with something unrelated.
 */
import type { DialogsApi, FileApi, ToastApi } from "@/app/context";
import type { Store } from "@/core/store";
import type { Translate } from "@/i18n";
import { DiskFile } from "./diskfile";
import { documentFileName, saveDocToFile, serializeDoc } from "./file";

/** Quiet time after the last edit before it is written. */
const AUTOSAVE_MS = 700;

export interface FileSessionOptions {
  store: Store;
  toast: ToastApi;
  dialogs: DialogsApi;
  t: Translate;
  /** how a document is opened where the browser cannot keep a link to the file */
  openWithoutLink(): void;
}

export interface FileSession extends FileApi {
  /** called after every change to the drawing */
  queueAutosave(): void;
}

export function createFileSession(options: FileSessionOptions): FileSession {
  const { store, toast, dialogs, t } = options;
  const disk = new DiskFile();
  let timer: number | undefined;
  let failedOnce = false;
  let pausedTold = false;

  const base = (): string => disk.name ?? "";

  const flush = async (): Promise<void> => {
    window.clearTimeout(timer);
    timer = undefined;
    if (!disk.canAutosave) return;
    try {
      const result = await disk.write(serializeDoc(store.doc));
      failedOnce = false;
      if (result === "stale") tellPaused();
    } catch (err) {
      console.error("[harness] autosave to file failed", err);
      if (!failedOnce) toast.error(t("toast.autosaveFailed"));
      failedOnce = true;
    }
  };

  /** Said once per outside change: the button is lit, but nobody watches a button. */
  const tellPaused = (): void => {
    if (pausedTold) return;
    pausedTold = true;
    toast.show(t("toast.fileChanged"), { duration: 8000 });
  };

  disk.onChange(() => {
    if (!disk.isStale) pausedTold = false;
  });

  /** Loads text read from the file as the drawing; throws if it is not a drawing. */
  const adopt = (text: string, reason: "open" | "reload"): void => {
    const parsed: unknown = JSON.parse(text);
    store.load(parsed, reason === "open" ? { reason } : { reason, resetHistory: false });
    // the drawing now is the file: the autosave that load queued has nothing to write
    disk.markLoaded(serializeDoc(store.doc));
  };

  const complain = (title: string, err: unknown): Promise<void> =>
    dialogs.alert({
      title,
      body: t("dialog.invalidFile", { error: err instanceof Error ? err.message : String(err) }),
    });

  // a tab that goes to the background is the last chance to write before it may be discarded
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && timer !== undefined) void flush();
  });

  const session: FileSession = {
    get attached() {
      return disk.attached;
    },
    get name() {
      return disk.name;
    },
    get autosaving() {
      return disk.canAutosave;
    },
    get stale() {
      return disk.isStale;
    },
    onChange: (fn) => disk.onChange(fn),

    queueAutosave(): void {
      if (!disk.attached) return;
      if (disk.isStale) {
        tellPaused();
        return;
      }
      if (!disk.canAutosave) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void flush(), AUTOSAVE_MS);
    },

    async open(): Promise<void> {
      if (!DiskFile.supported()) {
        // the plain file input cannot give back a file to write to
        disk.detach();
        options.openWithoutLink();
        return;
      }
      let text: string | null;
      try {
        text = await disk.pick();
      } catch (err) {
        await complain(t("topbar.open"), err);
        return;
      }
      if (text === null) return;
      try {
        adopt(text, "open");
      } catch (err) {
        disk.detach();
        await complain(t("topbar.open"), err);
        return;
      }
      toast.show(t("toast.openedFile", { name: base() }));
    },

    async save(): Promise<void> {
      window.clearTimeout(timer);
      timer = undefined;
      const text = serializeDoc(store.doc);
      if (disk.attached) {
        if (disk.isStale || (await disk.check())) {
          const ok = await dialogs.confirm({
            title: t("dialog.overwrite.title"),
            body: t("dialog.overwrite.body", { name: base() }),
            confirmLabel: t("dialog.overwrite.confirm"),
            cancelLabel: t("dialog.cancel"),
            danger: true,
          });
          if (!ok) return;
        }
        await disk.write(text, true);
        toast.show(t("toast.saved"));
        return;
      }
      await session.saveAs();
    },

    async saveAs(): Promise<void> {
      window.clearTimeout(timer);
      timer = undefined;
      if (!DiskFile.supported()) {
        saveDocToFile(store.doc);
        toast.show(t("toast.saved"));
        return;
      }
      const ok = await disk.pickToSave(documentFileName(store.doc, "json"), serializeDoc(store.doc));
      if (ok) toast.show(t("toast.savedFile", { name: base() }));
    },

    async reload(): Promise<void> {
      if (!disk.attached) return;
      window.clearTimeout(timer);
      timer = undefined;
      try {
        adopt(await disk.readText(), "reload");
      } catch (err) {
        // read, but not usable: keep what is on screen, and keep the file safe from autosave
        disk.flagChanged();
        await complain(t("topbar.reload"), err);
        return;
      }
      toast.show(t("toast.reloaded", { name: base() }));
    },

    detach(): void {
      window.clearTimeout(timer);
      timer = undefined;
      disk.detach();
    },
  };
  return session;
}
