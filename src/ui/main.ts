import "./tokens.css";
import "./style.css";
import "./printer.css";
import { composeWireItem, type Priority } from "../core/index";
import {
  EXAMPLE_SOURCED,
  EXAMPLE_UNSOURCED,
  formToDraft,
  heldProof,
  rejectionNotice,
  timeErrorNotice,
  type ClaimRow,
  type FormValues,
} from "./form";
import { createPrinter } from "./printer";
import { createSound, type AudioContextLike } from "./sound";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`Missing element #${id}`);
  return el as T;
}

const form = byId<HTMLFormElement>("compose-form");
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
// aria-pressed change.
const muteEl = document.createElement("button");
muteEl.type = "button";
muteEl.id = "mute-toggle";
muteEl.className = "btn mute-toggle";
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
toolsEl.append(bellLabelEl, muteEl);

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
const phoneQuery = window.matchMedia("(min-width: 900px)");

const printer = createPrinter({
  paper: paperEl,
  status: statusEl,
  bellLabel: bellLabelEl,
  sound,
  reducedMotion: () => reducedMotionQuery.matches,
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id),
});

const INERT_BUTTONS = [printEl, exampleSourcedEl, exampleUnsourcedEl];

printer.onBusyChange((busy) => {
  for (const button of INERT_BUTTONS) {
    if (busy) button.setAttribute("aria-disabled", "true");
    else button.removeAttribute("aria-disabled");
  }
  if (busy) {
    printInstantlyEl.hidden = false;
  } else {
    // Do not lose the focus position when the skip button goes away.
    const hadFocus = document.activeElement === printInstantlyEl;
    printInstantlyEl.hidden = true;
    if (hadFocus) printEl.focus();
  }
  // Phone layout: bring the printer into view when a print starts and ends.
  if (!phoneQuery.matches) {
    printerSectionEl.scrollIntoView({ block: busy ? "start" : "nearest" });
  }
});

printInstantlyEl.addEventListener("click", () => printer.skip());

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
  if (printer.isBusy()) return;
  fillForm(EXAMPLE_SOURCED);
});
exampleUnsourcedEl.addEventListener("click", () => {
  if (printer.isBusy()) return;
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
  const now = new Date().toISOString(); // the only clock read for the draft
  const { draft, rowIndexes, embargoInvalid } = formToDraft(readForm(), now);

  if (embargoInvalid) {
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
    printer.print({ kind: "held", stamp: proof.stamp, text: proof.text });
  } else {
    printer.print({
      kind: "released",
      text: result.item.text,
      priority: draft.priority,
    });
  }
});

addRow();
