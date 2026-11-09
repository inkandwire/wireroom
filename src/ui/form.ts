import {
  parseInstant,
  slugFromHeadline,
  type ClaimFailure,
  type Claim,
  type Draft,
  type Priority,
} from "../core/index";

export interface ClaimRow {
  text: string;
  sourceUrl: string;
}

export interface FormValues {
  city: string;
  headline: string;
  body: string;
  claims: ClaimRow[];
  priority: Priority;
  /** "YYYY-MM-DD" or "". */
  embargoDate: string;
  /** "HH:mm", "HH:mm:ss" or "". */
  embargoTime: string;
}

export interface MappedDraft {
  draft: Draft;
  /** rowIndexes[i] is the form row of draft.claims[i]. */
  rowIndexes: number[];
  /** Embargo fields filled but not a valid instant; draft.embargo is omitted. */
  embargoInvalid: boolean;
}

function buildEmbargo(date: string, time: string): string {
  const d = date.trim();
  const t = time.trim();
  let clock: string;
  if (t === "") clock = "00:00:00";
  else if (/^\d{2}:\d{2}$/.test(t)) clock = `${t}:00`;
  else clock = t;
  return `${d}T${clock}Z`;
}

/** Pure mapping from form values to a core draft. Never mutates `values`. */
export function formToDraft(values: FormValues, now: string): MappedDraft {
  const claims: Claim[] = [];
  const rowIndexes: number[] = [];
  values.claims.forEach((row, index) => {
    const text = row.text.trim();
    if (text === "") return;
    const url = row.sourceUrl.trim();
    claims.push(url === "" ? { text } : { text, sourceUrl: url });
    rowIndexes.push(index);
  });

  const draft: Draft = {
    headline: values.headline.trim(),
    body: values.body,
    claims,
    priority: values.priority,
    city: values.city.trim(),
    now,
  };

  let embargoInvalid = false;
  if (values.embargoDate.trim() !== "") {
    const candidate = buildEmbargo(values.embargoDate, values.embargoTime);
    if (parseInstant(candidate) === undefined) {
      embargoInvalid = true;
    } else {
      draft.embargo = candidate;
    }
  }

  return { draft, rowIndexes, embargoInvalid };
}

export interface RejectionItem {
  claimIndex: number;
  rowIndex: number;
  sentence: string;
}

export interface RejectionNotice {
  heading: string;
  items: RejectionItem[];
}

export function claimSentence(f: ClaimFailure): string {
  if (f.reason === "MISSING_SOURCE") {
    return `Claim "${f.text}" has no source URL. Add a link that backs it up.`;
  }
  return `Claim "${f.text}" has a source URL that is not a valid web address. Use a full http or https link.`;
}

export function rejectionNotice(
  failures: ClaimFailure[],
  rowIndexes: number[],
): RejectionNotice {
  const n = failures.length;
  const heading =
    n === 1
      ? "NOT RELEASED: 1 claim has no source."
      : `NOT RELEASED: ${n} claims have no source.`;
  const items = failures.map((f) => ({
    claimIndex: f.index,
    rowIndex: rowIndexes[f.index] ?? f.index,
    sentence: claimSentence(f),
  }));
  return { heading, items };
}

export function timeErrorNotice(errors: ("now" | "embargo")[]): string {
  const parts: string[] = [];
  if (errors.includes("now")) {
    parts.push("NOT RELEASED: the clock value is not valid.");
  }
  if (errors.includes("embargo")) {
    parts.push("NOT RELEASED: the embargo date and time are not valid.");
  }
  return parts.join(" ");
}

/** `YYYY-MM-DD HH:mm UTC` from an instant already accepted by parseInstant. */
export function formatReleaseTime(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function heldProof(
  draft: Draft,
  releaseAt: string,
): { stamp: string; text: string } {
  return {
    stamp: `HOLD UNTIL ${formatReleaseTime(releaseAt)}`,
    text: [
      slugFromHeadline(draft.headline),
      draft.priority,
      "",
      "TEXT WITHHELD UNTIL RELEASE.",
    ].join("\n"),
  };
}

export const EXAMPLE_SOURCED: FormValues = {
  city: "Austin",
  headline: "Ledgerly opens public beta",
  body:
    "Ledgerly, a bookkeeping app for freelancers, opened its public beta Tuesday. The app has 1,200 beta users, the company said.\n\nThe beta costs $9 a month, the company said.",
  claims: [
    {
      text: "The app has 1,200 beta users",
      sourceUrl: "https://example.com/ledgerly/beta-users",
    },
    {
      text: "The beta costs $9 a month",
      sourceUrl: "https://example.com/ledgerly/pricing",
    },
  ],
  priority: "BULLETIN",
  embargoDate: "",
  embargoTime: "",
};

export const EXAMPLE_UNSOURCED: FormValues = {
  ...EXAMPLE_SOURCED,
  claims: [
    { ...EXAMPLE_SOURCED.claims[0] },
    { text: EXAMPLE_SOURCED.claims[1].text, sourceUrl: "" },
  ],
};
