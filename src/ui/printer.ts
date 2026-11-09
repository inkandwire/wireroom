import type { Priority } from "../core/index";
import { formatReleaseTime } from "./form";
import { buildTimeline, type PlaybackEvent } from "./playback";
import type { Sound } from "./sound";

// DOM, thin. Every decision (timing, scaling, which events exist) lives in
// playback.ts; this module only plays a timeline onto the paper.

export interface PrinterDeps {
  paper: HTMLElement; // scroll region (aria-live="off")
  status: HTMLElement; // visually hidden role="status"
  bellLabel: HTMLElement; // "BELL" text label
  sound: Pick<Sound, "clack" | "thunk" | "bell">;
  reducedMotion: () => boolean;
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
}

export type PrintJob =
  | {
      kind: "released";
      text: string;
      priority: Priority;
      /** Replaces the status text, for example `Released: <slug>`. */
      announce?: string;
    }
  | {
      kind: "held";
      stamp: string;
      text: string;
      /** Id of the held entry; adds the ticker to the proof sheet. */
      holdId?: string;
      /** Release instant (ISO UTC), written to `<time datetime>`. */
      releaseIso?: string;
      /** First countdown label, supplied by the caller (it owns the clock). */
      countdownLabel?: string;
      /** Replaces the status text, for example `Held until <time>`. */
      announce?: string;
    };

export interface Printer {
  print(job: PrintJob): void; // ignored while busy
  skip(): void; // Print instantly
  isBusy(): boolean;
  onBusyChange(cb: (busy: boolean) => void): void;
}

export const BELL_LABEL_MS = 1500;
export const STATUS_CLEAR_MS = 1000;

export const BELL_LABEL_ON_CLASS = "bell-label--on";
export const ITEM_CUT_CLASS = "item--cut";
export const ITEM_SHIFT_CLASS = "item--shift";
export const COUNTDOWN_NOTE =
  "Kept in this page only. Closing it cancels the release.";
export const TICKER_TITLE = "RELEASE IN";
export const RELEASE_NOW_ID = "release-now";
export const CANCEL_EMBARGO_ID = "cancel-embargo";
export const RELEASE_NOW_TEXT = "Release now";
export const CANCEL_EMBARGO_TEXT = "Cancel embargo";

export function createPrinter(deps: PrinterDeps): Printer {
  const listeners: Array<(busy: boolean) => void> = [];
  let busy = false;

  // Typing timer: at most one pending, none after an item ends.
  let typingTimer: number | undefined;
  // Display timers (BELL label and status clear). They only touch text and a
  // class, never the paper, and are cleared when the next item starts.
  let bellTimer: number | undefined;
  let statusTimer: number | undefined;

  // State of the item being printed.
  let events: PlaybackEvent[] = [];
  let index = 0;
  let clock = 0; // virtual time of the last applied step, not a clock read
  let itemEl: HTMLElement | undefined;
  let textNode: Text | undefined;
  let statusText = "";
  let reduced = false;

  const setBusy = (value: boolean): void => {
    if (busy === value) return;
    busy = value;
    for (const cb of listeners) cb(value);
  };

  const clearTyping = (): void => {
    if (typingTimer !== undefined) {
      deps.clearTimeout(typingTimer);
      typingTimer = undefined;
    }
  };

  const hideBellLabel = (): void => {
    if (bellTimer !== undefined) {
      deps.clearTimeout(bellTimer);
      bellTimer = undefined;
    }
    deps.bellLabel.classList.remove(BELL_LABEL_ON_CLASS);
  };

  const showBellLabel = (): void => {
    if (bellTimer !== undefined) deps.clearTimeout(bellTimer);
    deps.bellLabel.classList.add(BELL_LABEL_ON_CLASS);
    bellTimer = deps.setTimeout(() => {
      bellTimer = undefined;
      deps.bellLabel.classList.remove(BELL_LABEL_ON_CLASS);
    }, BELL_LABEL_MS);
  };

  const clearStatus = (): void => {
    if (statusTimer !== undefined) {
      deps.clearTimeout(statusTimer);
      statusTimer = undefined;
    }
    deps.status.textContent = "";
  };

  const scrollToBottom = (): void => {
    deps.paper.scrollTop = deps.paper.scrollHeight; // never smooth
  };

  const finish = (): void => {
    clearTyping();
    events = [];
    index = 0;
    itemEl = undefined;
    textNode = undefined;
    scrollToBottom();
    // One update, cleared about 1 s later so it is read once.
    deps.status.textContent = statusText;
    statusTimer = deps.setTimeout(() => {
      statusTimer = undefined;
      deps.status.textContent = "";
    }, STATUS_CLEAR_MS);
    setBusy(false);
  };

  /** Applies one event. `quiet` skips key sounds, bells and the bell label. */
  const apply = (event: PlaybackEvent, quiet: boolean): void => {
    switch (event.kind) {
      case "char":
        textNode?.appendData(event.char);
        if (!quiet && !reduced) deps.sound.clack(event.char);
        break;
      case "newline":
        textNode?.appendData("\n");
        scrollToBottom();
        break;
      case "bell":
        if (quiet) break;
        showBellLabel();
        if (!reduced) deps.sound.bell();
        break;
      case "tear":
        if (itemEl !== undefined) {
          itemEl.classList.add(ITEM_CUT_CLASS);
          if (!reduced) itemEl.classList.add(ITEM_SHIFT_CLASS);
        }
        if (!reduced) deps.sound.thunk();
        finish();
        break;
    }
  };

  /** Applies every event due at the virtual clock, then waits for the next. */
  const pump = (): void => {
    while (index < events.length) {
      const event = events[index] as PlaybackEvent;
      if (event.at > clock) {
        const wait = event.at - clock;
        typingTimer = deps.setTimeout(() => {
          typingTimer = undefined;
          clock = event.at;
          pump();
        }, wait);
        return;
      }
      index += 1;
      apply(event, false);
    }
  };

  const buildItem = (job: PrintJob): void => {
    const doc = deps.paper.ownerDocument;
    deps.paper.querySelector<HTMLElement>(".empty")?.setAttribute("hidden", "");

    const item = doc.createElement("div");
    item.className = "item";
    if (job.kind === "held") {
      item.classList.add("item--held");
      if (job.holdId !== undefined) item.dataset.holdId = job.holdId;
      const stamp = doc.createElement("div");
      stamp.className = "stamp";
      stamp.textContent = job.stamp;
      item.append(stamp);
    }
    const pre = doc.createElement("pre");
    pre.className = "item-text";
    const node = doc.createTextNode("");
    pre.append(node);
    item.append(pre);

    // Held area of a held proof: the ticker, the warning strip and the two
    // keys. Not a live region: the status region never hears it, and the paper
    // is aria-live="off". `.countdown-label` is the node the clock loop
    // updates. The keys carry no handlers here; main.ts wires them.
    if (
      job.kind === "held" &&
      job.holdId !== undefined &&
      job.releaseIso !== undefined
    ) {
      const area = doc.createElement("div");
      area.className = "hold-area";

      const ticker = doc.createElement("div");
      ticker.className = "ticker";
      const title = doc.createElement("span");
      title.className = "ticker-title";
      title.textContent = TICKER_TITLE;
      const label = doc.createElement("span");
      label.className = "countdown-label ticker-digits";
      label.textContent = job.countdownLabel ?? "T-??:??:??";
      const time = doc.createElement("time");
      time.className = "countdown-time";
      time.dateTime = job.releaseIso;
      time.textContent = formatReleaseTime(job.releaseIso);
      ticker.append(title, label, time);

      // The warning mark is drawn by CSS (aria-hidden by construction), so the
      // text of this element is exactly the sentence.
      const warning = doc.createElement("p");
      warning.className = "hold-warning";
      warning.textContent = COUNTDOWN_NOTE;

      const keys = doc.createElement("div");
      keys.className = "hold-keys";
      const releaseNow = doc.createElement("button");
      releaseNow.type = "button";
      releaseNow.id = RELEASE_NOW_ID;
      releaseNow.className = "btn";
      releaseNow.textContent = RELEASE_NOW_TEXT;
      const cancel = doc.createElement("button");
      cancel.type = "button";
      cancel.id = CANCEL_EMBARGO_ID;
      cancel.className = "btn";
      cancel.textContent = CANCEL_EMBARGO_TEXT;
      keys.append(releaseNow, cancel);

      area.append(ticker, warning, keys);
      item.append(area);
    }
    deps.paper.append(item);

    itemEl = item;
    textNode = node;
  };

  const print = (job: PrintJob): void => {
    if (busy) return;
    setBusy(true);

    clearStatus();
    hideBellLabel();
    reduced = deps.reducedMotion();
    statusText =
      job.announce ??
      (job.kind === "held" ? `Item held, not released. ${job.stamp}.` : job.text);

    buildItem(job);
    // A held proof has no bell: it is not a release.
    const priority: Priority = job.kind === "released" ? job.priority : "ROUTINE";
    events = buildTimeline(job.text, priority, reduced);
    index = 0;
    clock = 0;
    scrollToBottom();
    pump(); // under reduced motion every event is at 0, so this finishes at once
  };

  const skip = (): void => {
    if (!busy) return;
    clearTyping();
    while (index < events.length) {
      const event = events[index] as PlaybackEvent;
      index += 1;
      apply(event, true); // the tear is last and runs finish() once
    }
  };

  return {
    print,
    skip,
    isBusy: () => busy,
    onBusyChange(cb: (busy: boolean) => void): void {
      listeners.push(cb);
    },
  };
}
