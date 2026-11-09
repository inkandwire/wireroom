// Test helper: a small fake AudioContext that records the node graph.
import type {
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
} from "./sound";

export interface FakeParam extends AudioParamLike {
  events: Array<{ kind: "set" | "ramp"; v: number; t: number }>;
}
export interface FakeNode extends AudioNodeLike {
  kind: "gain" | "filter" | "osc" | "buffer" | "destination";
  type: string;
  buffer: unknown;
  gain: FakeParam;
  frequency: FakeParam;
  Q: FakeParam;
  targets: FakeNode[];
  starts: Array<number | undefined>;
  stops: Array<number | undefined>;
  start(t?: number): void;
  stop(t?: number): void;
}

export interface FakeContext extends AudioContextLike {
  nodes: FakeNode[];
  resumeCalls: number;
  destinationNode: FakeNode;
}

function param(): FakeParam {
  const p: FakeParam = {
    value: 1,
    events: [],
    setValueAtTime(v, t) {
      p.events.push({ kind: "set", v, t });
      p.value = v;
    },
    exponentialRampToValueAtTime(v, t) {
      p.events.push({ kind: "ramp", v, t });
    },
  };
  return p;
}

export function makeFakeContext(
  opts: { resumeRejects?: boolean } = {},
): FakeContext {
  const nodes: FakeNode[] = [];
  const mk = (kind: FakeNode["kind"]): FakeNode => {
    const n: FakeNode = {
      kind,
      type: "",
      buffer: undefined,
      gain: param(),
      frequency: param(),
      Q: param(),
      targets: [],
      starts: [],
      stops: [],
      connect(dest) {
        n.targets.push(dest as FakeNode);
      },
      start(t) {
        n.starts.push(t);
      },
      stop(t) {
        n.stops.push(t);
      },
    };
    nodes.push(n);
    return n;
  };
  const destinationNode = mk("destination");
  const ctx: FakeContext = {
    nodes,
    resumeCalls: 0,
    destinationNode,
    currentTime: 0,
    sampleRate: 8000,
    destination: destinationNode,
    resume() {
      ctx.resumeCalls++;
      return opts.resumeRejects
        ? Promise.reject(new Error("blocked"))
        : Promise.resolve();
    },
    createGain: () => mk("gain"),
    createBiquadFilter: () => mk("filter"),
    createOscillator: () => mk("osc"),
    createBufferSource: () => mk("buffer"),
    createBuffer: (_c, length) => ({
      getChannelData: () => new Float32Array(length),
    }),
  };
  return ctx;
}

export function startedSources(ctx: FakeContext): FakeNode[] {
  return ctx.nodes.filter(
    (n) => (n.kind === "osc" || n.kind === "buffer") && n.starts.length > 0,
  );
}

/** Peak gain of each path from a source to the destination (product of gain values). */
export function pathGains(ctx: FakeContext, source: FakeNode): number[] {
  const out: number[] = [];
  const walk = (n: FakeNode, acc: number, depth: number): void => {
    if (depth > 20) return;
    if (n === ctx.destinationNode) {
      out.push(acc);
      return;
    }
    const next = n.kind === "gain" ? acc * n.gain.value : acc;
    for (const t of n.targets) walk(t, next, depth + 1);
  };
  walk(source, 1, 0);
  return out;
}

/** Nodes that connect straight to the destination. */
export function destinationFeeders(ctx: FakeContext): FakeNode[] {
  return ctx.nodes.filter((n) => n.targets.includes(ctx.destinationNode));
}
