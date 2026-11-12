// Demo fills for the two Demo buttons. Pure: time is passed in as `now`.

export interface DemoFill {
  city: string;
  priority: string;
  headline: string;
  body: string;
  claims: { text: string; sourceUrl: string }[];
  embargoDate: string;
  embargoTime: string;
}

const MINUTE_MS = 60000;
const MIN_LEAD_MS = 45000;

/** Embargo instant in ms: 45 to 105 seconds ahead, on a whole UTC minute. */
export function embargoInstant(now: number): number {
  return Math.ceil((now + MIN_LEAD_MS) / MINUTE_MS) * MINUTE_MS;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function utcDate(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
}

function utcTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCHours(), 2)}:${pad(d.getUTCMinutes(), 2)}`;
}

const BODY =
  "Ledgerly, a bookkeeping app for freelancers, opened its public beta Tuesday. The app has 1,200 beta users, the company said.\n\nThe beta costs $9 a month, the company said.";

/** Made-up draft with one claim that has no source URL. */
export function buildUnsourcedDemo(): DemoFill {
  return {
    city: "Austin",
    priority: "BULLETIN",
    headline: "Ledgerly opens public beta",
    body: BODY,
    claims: [
      {
        text: "The app has 1,200 beta users",
        sourceUrl: "https://example.com/ledgerly/beta-users",
      },
      { text: "The beta costs $9 a month", sourceUrl: "" },
    ],
    embargoDate: "",
    embargoTime: "",
  };
}

/** Fully sourced draft (example.com links), embargoed to `embargoInstant(now)`. */
export function buildSourcedDemo(now: number): DemoFill {
  const at = embargoInstant(now);
  return {
    city: "Austin",
    priority: "BULLETIN",
    headline: "Ledgerly opens public beta",
    body: BODY,
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
    embargoDate: utcDate(at),
    embargoTime: utcTime(at),
  };
}
