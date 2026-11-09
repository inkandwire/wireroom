import "./tokens.css";
import "./style.css";
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

byId("example-sourced").addEventListener("click", () => {
  fillForm(EXAMPLE_SOURCED);
});
byId("example-unsourced").addEventListener("click", () => {
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

// ---- Printing (instant; animation comes later) ---------------------------

function printItem(text: string, stamp?: string): void {
  byId("empty").hidden = true;
  const item = document.createElement("div");
  item.className = "item";
  if (stamp !== undefined) {
    item.classList.add("item--held");
    const stampEl = document.createElement("div");
    stampEl.className = "stamp";
    stampEl.textContent = stamp;
    item.append(stampEl);
  }
  const pre = document.createElement("pre");
  pre.className = "item-text";
  pre.textContent = text;
  item.append(pre);
  paperEl.append(item);
  paperEl.scrollTop = paperEl.scrollHeight;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const now = new Date().toISOString(); // the only clock read for the draft
  const { draft, rowIndexes, embargoInvalid } = formToDraft(readForm(), now);

  if (embargoInvalid) {
    showNotice({ heading: timeErrorNotice(["embargo"]) });
    return;
  }

  const result = composeWireItem(draft);
  if (result.status === "REJECTED") {
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
    printItem(proof.text, proof.stamp);
  } else {
    printItem(result.item.text);
  }
});

addRow();
