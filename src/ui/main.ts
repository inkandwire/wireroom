import "./tokens.css";
import "./style.css";
import "./printer.css";
import "./fit.css";
import {
  composeWireItem,
  countdown,
  entriesFromResult,
  type FeedEntry,
  type Priority,
  type ReleasedOne,
} from "../core/index";
import { createClockLoop, type ClockRow } from "./clockLoop";
import { buildSourcedDemo, buildUnsourcedDemo, type DemoFill } from "./demo";
import { buildExport, type ExportKind } from "./exportFeed";
import {
  EXAMPLE_SOURCED,
  EXAMPLE_UNSOURCED,
  formToDraft,
  formatReleaseTime,
  heldProof,
  rejectionNotice,
  timeErrorNotice,
  type ClaimRow,
  type FormValues,
} from "./form";
import { CANCEL_ANNOUNCE, lockView } from "./heldState";
import {
  CANCEL_EMBARGO_ID,
  RELEASE_NOW_ID,
  createPrinter,
  type PrintJob,
} from "./printer";
import { createSound, type AudioContextLike } from "./sound";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`Missing element #${id}`);
  return el as T;
}

const form = byId<HTMLFormElement>("compose-form");
const formFieldsEl = byId<HTMLFieldSetElement>("form-fields");
const lockReasonEl = byId<HTMLElement>("lock-reason");
const cityEl = byId<HTMLInputElement>("city");
const headlineEl = byId<HTMLInputElement>("headline");
const bodyEl = byId<HTMLTextAreaElement>("body");
const priorityEl = byId<HTMLSelectElement>("priority");
const embargoDateEl = byId<HTMLInputElement>("embargo-date");
const embargoTimeEl = byId<HTMLInputElement>("embargo-time");
const claimsEl = byId<HTMLElement>("claims");
const addClaimEl = byId<HTMLButtonElement>("add-claim");
const noticeEl = byId<HTMLElement>("notice");
const paperEl = byId<HTMLElement>("paper");
const statusEl = byId<HTMLElement>("status");
const toolsEl = byId<HTMLElement>("nameplate-tools");
const printEl = byId<HTMLButtonElement>("print");
const printInstantlyEl = byId<HTMLButtonElement>("print-instantly");
const exampleSourcedEl = byId<HTMLButtonElement>("example-sourced");
const exampleUnsourcedEl = byId<HTMLButtonElement>("example-unsourced");
const demoUnsourcedEl = byId<HTMLButtonElement>("demo-unsourced");
const demoSourcedEl = byId<HTMLButtonElement>("demo-sourced");
const composeEl = document.querySelector<HTMLElement>(".compose");
const printerSectionEl = document.querySelector<HTMLElement>(".printer") ?? paperEl;

// ---- Sound, mute toggle, BELL label --------------------------------------

const sound = createSound({
  createContext: () =>
    typeof AudioContext === "undefined"
      ? undefined
      : (new AudioContext() as unknown as AudioContextLike),
  now: () => performance.now(), // clock for the clack rate limit only
});

const bellLabelEl = document.createElement("span");
bellLabelEl.id = "bell-label";
bellLabelEl.className = "bell-label";
bellLabelEl.textContent = "BELL";

// The accessible name stays "Mute sound"; only the visible text and
// aria-pressed change. The three feed keys (Mute, Export RSS, Export JSON)
// share the .feed-key class so they have the same height.
const muteEl = document.createElement("button");
muteEl.type = "button";
muteEl.id = "mute-toggle";
muteEl.className = "btn feed-key mute-toggle";
muteEl.setAttribute("aria-label", "Mute sound");

function renderMute(): void {
  const muted = sound.isMuted();
  muteEl.setAttribute("aria-pressed", String(muted));
  muteEl.textContent = muted ? "Muted" : "Sound on";
}
renderMute();

muteEl.addEventListener("click", () => {
  sound.unlock(); // same handler as the user gesture
  sound.setMuted(!sound.isMuted());
  renderMute();
});

// ---- Session list and export keys ----------------------------------------

// Released items of this page session, in print order. Only RELEASED results
// are added, so a held or rejected draft never reaches a feed.
const sessionEntries: FeedEntry[] = [];

const exportRssEl = document.createElement("button");
exportRssEl.type = "button";
exportRssEl.id = "export-rss";
exportRssEl.className = "btn feed-key export-key";
exportRssEl.textContent = "Export RSS";
exportRssEl.setAttribute("aria-disabled", "true");

const exportJsonEl = document.createElement("button");
exportJsonEl.type = "button";
exportJsonEl.id = "export-json";
exportJsonEl.className = "btn feed-key export-key";
exportJsonEl.textContent = "Export JSON feed";
exportJsonEl.setAttribute("aria-disabled", "true");

function renderExportKeys(): void {
  const empty = sessionEntries.length === 0;
  for (const key of [exportRssEl, exportJsonEl]) {
    if (empty) key.setAttribute("aria-disabled", "true");
    else key.removeAttribute("aria-disabled");
  }
}

function downloadExport(kind: ExportKind): void {
  if (sessionEntries.length === 0) return; // inert while the list is empty
  const generatedAt = new Date().toISOString(); // UI may read the clock
  const file = buildExport(kind, sessionEntries, generatedAt);
  const blob = new Blob([file.text], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.fileName;
  document.body.append(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

exportRssEl.addEventListener("click", () => downloadExport("rss"));
exportJsonEl.addEventListener("click", () => downloadExport("json"));

// The BELL label sits in the printer bar just before the toolbar, outside it.
// The toolbar holds only the three feed keys.
toolsEl.before(bellLabelEl);
toolsEl.append(muteEl, exportRssEl, exportJsonEl);

// First click or key press anywhere unlocks audio. It makes no sound.
function unlockOnce(): void {
  document.removeEventListener("pointerdown", unlockOnce);
  document.removeEventListener("keydown", unlockOnce);
  sound.unlock();
}
document.addEventListener("pointerdown", unlockOnce);
document.addEventListener("keydown", unlockOnce);

// ---- Printer -------------------------------------------------------------

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const desktopQuery = window.matchMedia("(min-width: 900px)");

const printer = createPrinter({
  paper: paperEl,
  status: statusEl,
  bellLabel: bellLabelEl,
  sound,
  reducedMotion: () => reducedMotionQuery.matches,
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id),
});

// True while at least one story is held. The clock loop owns the list.
function isLocked(): boolean {
  return clockLoop.size() > 0;
}

function setAriaDisabled(el: HTMLElement, on: boolean): void {
  if (on) el.setAttribute("aria-disabled", "true");
  else el.removeAttribute("aria-disabled");
}

// Print and the examples are inert while the printer is busy or a story is
// held. Print instantly is inert only while held and not printing: during the
// print of the held proof itself it must stay usable to skip ahead.
// The two Demo buttons are really `disabled` in the same states.
function syncInert(): void {
  const busy = printer.isBusy();
  const locked = isLocked();
  setAriaDisabled(printEl, busy || locked);
  setAriaDisabled(exampleSourcedEl, busy || locked);
  setAriaDisabled(exampleUnsourcedEl, busy || locked);
  demoUnsourcedEl.disabled = busy || locked;
  demoSourcedEl.disabled = busy || locked;
  setAriaDisabled(printInstantlyEl, locked && !busy);
}

printer.onBusyChange((busy) => {
  syncInert();
  if (busy) {
    printInstantlyEl.hidden = false;
  } else {
    // Do not lose the focus position when the skip button goes away.
    const hadFocus = document.activeElement === printInstantlyEl;
    printInstantlyEl.hidden = true;
    if (hadFocus) {
      // While a story is held the form is locked, so go to the held keys.
      if (isLocked()) document.getElementById(RELEASE_NOW_ID)?.focus();
      else printEl.focus();
    }
  }
  // Phone layout: bring the printer into view when a print starts and ends.
  if (!desktopQuery.matches) {
    printerSectionEl.scrollIntoView({ block: busy ? "start" : "nearest" });
  }
});

printInstantlyEl.addEventListener("click", () => printer.skip());

// FIFO for prints that arrive while the printer is busy (releases from hold).
// Items are queued in release order and none is dropped.
const printQueue: PrintJob[] = [];

function drainPrintQueue(): void {
  while (!printer.isBusy()) {
    const next = printQueue.shift();
    if (next === undefined) return;
    printer.print(next);
  }
}

function enqueuePrint(job: PrintJob): void {
  printQueue.push(job);
  drainPrintQueue();
}

printer.onBusyChange((busy) => {
  if (!busy) drainPrintQueue();
});

// ---- Embargo clock -------------------------------------------------------

// Held entries live in memory for this page session only: no storage and no
// network. This is the only place that reads the real clock for the loop.
let holdCounter = 0;

function holdItemEl(id: string): HTMLElement | null {
  return paperEl.querySelector<HTMLElement>(`[data-hold-id="${id}"]`);
}

/** Form lock: disables the fields and shows the reason line while held. */
function applyLock(): void {
  const view = lockView(clockLoop.size());
  formFieldsEl.disabled = view.locked;
  lockReasonEl.textContent = view.reason;
  lockReasonEl.hidden = !view.locked;
  if (composeEl !== null) {
    if (view.locked) composeEl.setAttribute("data-locked", "");
    else composeEl.removeAttribute("data-locked");
  }
  syncInert();
}

function onClockTick(rows: ClockRow[]): void {
  for (const row of rows) {
    const label = holdItemEl(row.id)?.querySelector(".countdown-label");
    if (label && label.textContent !== row.label) label.textContent = row.label;
  }
}

function onClockRelease(one: ReleasedOne): void {
  // The loop (or take) has already removed the entry, so this unlocks the
  // form when it was the last held story.
  applyLock();
  if (one.result.status !== "RELEASED") return; // cannot happen after a due tick
  const { entry, result } = one;

  const itemEl = holdItemEl(entry.id);
  itemEl?.querySelector(".stamp")?.classList.add("stamp--lifted");
  const label = itemEl?.querySelector(".countdown-label");
  if (label) label.textContent = "RELEASED";
  itemEl?.querySelector(".ticker-title")?.remove(); // else it reads "RELEASE IN RELEASED"
  itemEl?.querySelector(".hold-warning")?.remove();
  itemEl?.querySelector(".hold-keys")?.remove();

  // publishedAt is the release time, never the wake-up time.
  sessionEntries.push(...entriesFromResult(result, entry.releaseAt));
  renderExportKeys();

  enqueuePrint({
    kind: "released",
    text: result.item.text,
    priority: entry.draft.priority,
    announce: `Released: ${result.item.slug}`,
  });
}

const clockLoop = createClockLoop({
  now: () => Date.now(),
  setInterval: (fn, ms) => window.setInterval(fn, ms),
  clearInterval: (id) => window.clearInterval(id),
  onTick: onClockTick,
  onRelease: onClockRelease,
});

// Release now: an explicit key press ends the hold early. The claim gate has
// already passed before the hold, and nothing is published without the press.
// It goes through the same path as the clock release (onClockRelease); the
// release time is the click time.
function releaseNow(id: string): void {
  const held = clockLoop.take(id);
  if (held === undefined) return;
  const nowIso = new Date(Date.now()).toISOString(); // the UI reads the clock
  const draft = { ...held.draft, now: nowIso, embargo: nowIso };
  const result = composeWireItem(draft);
  onClockRelease({
    entry: { ...held, draft, releaseAt: nowIso },
    result,
  });
  headlineEl.focus();
}

// Cancel embargo: drop the held story without printing it. Nothing goes to a
// feed.
function cancelEmbargo(id: string): void {
  const held = clockLoop.take(id);
  if (held === undefined) return;
  const itemEl = holdItemEl(id);
  const label = itemEl?.querySelector(".countdown-label");
  if (label) label.textContent = "CANCELLED";
  itemEl?.querySelector(".hold-warning")?.remove();
  itemEl?.querySelector(".hold-keys")?.remove();
  statusEl.textContent = CANCEL_ANNOUNCE;
  window.setTimeout(() => {
    if (statusEl.textContent === CANCEL_ANNOUNCE) statusEl.textContent = "";
  }, 1000);
  applyLock();
  headlineEl.focus();
}

paperEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const key = target.closest("button");
  if (key === null) return;
  const id = key.closest<HTMLElement>("[data-hold-id]")?.dataset.holdId;
  if (id === undefined) return;
  if (key.id === RELEASE_NOW_ID) releaseNow(id);
  else if (key.id === CANCEL_EMBARGO_ID) cancelEmbargo(id);
});

// ---- Claim rows ----------------------------------------------------------

function rowEls(): HTMLElement[] {
  return Array.from(claimsEl.querySelectorAll<HTMLElement>(".claim-row"));
}

function renumber(): void {
  rowEls().forEach((row, i) => {
    const n = i + 1;
    const text = row.querySelector<HTMLInputElement>(".claim-text");
    const url = row.querySelector<HTMLInputElement>(".claim-url");
    const textLabel = row.querySelector<HTMLLabelElement>(".claim-text-label");
    const urlLabel = row.querySelector<HTMLLabelElement>(".claim-url-label");
    const remove = row.querySelector<HTMLButtonElement>(".claim-remove");
    if (!text || !url || !textLabel || !urlLabel || !remove) return;
    text.id = `claim-text-${n}`;
    url.id = `claim-url-${n}`;
    textLabel.htmlFor = text.id;
    urlLabel.htmlFor = url.id;
    textLabel.textContent = `Claim ${n}`;
    urlLabel.textContent = `Source URL for claim ${n}`;
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove claim ${n}`);
  });
}

function addRow(text = "", sourceUrl = ""): HTMLElement {
  const row = document.createElement("div");
  row.className = "claim-row";

  const textField = document.createElement("div");
  textField.className = "field";
  const textLabel = document.createElement("label");
  textLabel.className = "claim-text-label";
  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.className = "claim-text";
  textInput.autocomplete = "off";
  textInput.value = text;
  textField.append(textLabel, textInput);

  const urlField = document.createElement("div");
  urlField.className = "field";
  const urlLabel = document.createElement("label");
  urlLabel.className = "claim-url-label";
  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.className = "claim-url";
  urlInput.autocomplete = "off";
  urlInput.value = sourceUrl;
  urlField.append(urlLabel, urlInput);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn claim-remove";
  remove.addEventListener("click", () => removeRow(row));

  row.append(textField, urlField, remove);
  claimsEl.append(row);
  renumber();
  return row;
}

function removeRow(row: HTMLElement): void {
  const rows = rowEls();
  if (rows.length <= 1) {
    const text = row.querySelector<HTMLInputElement>(".claim-text");
    const url = row.querySelector<HTMLInputElement>(".claim-url");
    if (text) text.value = "";
    if (url) url.value = "";
    text?.focus();
    return;
  }
  const index = rows.indexOf(row);
  row.remove();
  renumber();
  const after = rowEls()[index];
  if (after) after.querySelector<HTMLInputElement>(".claim-text")?.focus();
  else addClaimEl.focus();
}

addClaimEl.addEventListener("click", () => {
  const row = addRow();
  row.querySelector<HTMLInputElement>(".claim-text")?.focus();
});

// ---- Form values ---------------------------------------------------------

function readForm(): FormValues {
  const claims: ClaimRow[] = rowEls().map((row) => ({
    text: row.querySelector<HTMLInputElement>(".claim-text")?.value ?? "",
    sourceUrl: row.querySelector<HTMLInputElement>(".claim-url")?.value ?? "",
  }));
  return {
    city: cityEl.value,
    headline: headlineEl.value,
    body: bodyEl.value,
    claims,
    priority: priorityEl.value as Priority,
    embargoDate: embargoDateEl.value,
    embargoTime: embargoTimeEl.value,
  };
}

function fillForm(values: FormValues): void {
  cityEl.value = values.city;
  headlineEl.value = values.headline;
  bodyEl.value = values.body;
  priorityEl.value = values.priority;
  embargoDateEl.value = values.embargoDate;
  embargoTimeEl.value = values.embargoTime;
  claimsEl.replaceChildren();
  const rows = values.claims.length > 0 ? values.claims : [{ text: "", sourceUrl: "" }];
  for (const r of rows) addRow(r.text, r.sourceUrl);
}

exampleSourcedEl.addEventListener("click", () => {
  if (printer.isBusy() || isLocked()) return;
  fillForm(EXAMPLE_SOURCED);
});
exampleUnsourcedEl.addEventListener("click", () => {
  if (printer.isBusy() || isLocked()) return;
  fillForm(EXAMPLE_UNSOURCED);
});

// ---- Notice --------------------------------------------------------------

function clearNotice(): void {
  noticeEl.replaceChildren();
  noticeEl.classList.remove("notice--shown");
}

function showNotice(parts: { heading: string; entries?: { text: string; rowIndex: number }[] }): void {
  noticeEl.replaceChildren();
  const heading = document.createElement("p");
  heading.className = "notice-heading";
  heading.textContent = parts.heading;
  noticeEl.append(heading);
  if (parts.entries && parts.entries.length > 0) {
    const list = document.createElement("ul");
    for (const entry of parts.entries) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `#claim-url-${entry.rowIndex + 1}`;
      a.textContent = entry.text;
      a.addEventListener("click", (event) => {
        event.preventDefault();
        document.getElementById(`claim-url-${entry.rowIndex + 1}`)?.focus();
      });
      li.append(a);
      list.append(li);
    }
    noticeEl.append(list);
  }
  noticeEl.classList.add("notice--shown");
  noticeEl.focus();
}

// ---- Print ---------------------------------------------------------------

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (printer.isBusy()) return; // Print is inert while an item prints
  if (isLocked()) return; // Print is inert while a story is held
  const nowMs = Date.now(); // the only clock read for the draft
  const now = new Date(nowMs).toISOString();
  const { draft, rowIndexes, embargoInvalid } = formToDraft(readForm(), now);

  if (embargoInvalid) {
    // Never added to the clock loop.
    showNotice({ heading: timeErrorNotice(["embargo"]) });
    return;
  }

  const result = composeWireItem(draft);
  if (result.status === "REJECTED") {
    // Nothing prints and nothing sounds.
    if (result.failures.length > 0) {
      const notice = rejectionNotice(result.failures, rowIndexes);
      showNotice({
        heading: notice.heading,
        entries: notice.items.map((i) => ({ text: i.sentence, rowIndex: i.rowIndex })),
      });
    } else {
      showNotice({ heading: timeErrorNotice(result.timeErrors) });
    }
    return;
  }

  clearNotice();
  if (result.status === "HELD") {
    const proof = heldProof(draft, result.releaseAt);
    holdCounter += 1;
    const id = `hold-${holdCounter}`;
    printer.print({
      kind: "held",
      stamp: proof.stamp,
      text: proof.text,
      holdId: id,
      releaseIso: result.releaseAt,
      countdownLabel: countdown(result.releaseAt, nowMs).label,
      announce: `Held until ${formatReleaseTime(result.releaseAt)}`,
    });
    // Not in any feed until the loop releases it.
    clockLoop.add({ id, draft, releaseAt: result.releaseAt });
    applyLock();
  } else {
    // Same `now` as the draft. entriesFromResult is empty for HELD/REJECTED.
    sessionEntries.push(...entriesFromResult(result, now));
    renderExportKeys();
    printer.print({
      kind: "released",
      text: result.item.text,
      priority: draft.priority,
    });
  }
});

// ---- Demo buttons --------------------------------------------------------

// Fill the form, then submit through the same handler as Print.
function runDemo(fill: DemoFill): void {
  if (printer.isBusy() || isLocked()) return;
  fillForm({ ...fill, priority: fill.priority as Priority });
  form.requestSubmit();
}

demoUnsourcedEl.addEventListener("click", () => runDemo(buildUnsourcedDemo()));
demoSourcedEl.addEventListener("click", () => runDemo(buildSourcedDemo(Date.now()))); // UI reads the clock

addRow();
applyLock();
