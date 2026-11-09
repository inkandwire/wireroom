// Synthesised teletype sound. No globals: the audio context factory and the
// clock arrive through `deps`, so this runs in node with a fake.

export interface AudioParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
}
export interface AudioNodeLike {
  connect(dest: AudioNodeLike): unknown;
}
export interface GainNodeLike extends AudioNodeLike {
  gain: AudioParamLike;
}
export interface FilterNodeLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  Q: AudioParamLike;
}
export interface SourceNodeLike extends AudioNodeLike {
  start(t?: number): void;
  stop(t?: number): void;
}
export interface OscillatorNodeLike extends SourceNodeLike {
  type: string;
  frequency: AudioParamLike;
}
export interface BufferSourceNodeLike extends SourceNodeLike {
  buffer: unknown;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: AudioNodeLike;
  resume(): Promise<void> | void;
  createGain(): GainNodeLike;
  createBiquadFilter(): FilterNodeLike;
  createOscillator(): OscillatorNodeLike;
  createBufferSource(): BufferSourceNodeLike;
  createBuffer(
    channels: number,
    length: number,
    sampleRate: number,
  ): { getChannelData(c: number): Float32Array };
}

export interface SoundDeps {
  createContext: (() => AudioContextLike | undefined) | undefined;
  now: () => number; // ms, monotonic; injected
}
export interface Sound {
  unlock(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  isUnlocked(): boolean;
  clack(char: string): void;
  thunk(): void;
  bell(): void;
}

export const MASTER_GAIN_MAX = 0.25;
export const MAX_CLACKS_PER_SECOND = 40;

const CLACK_NOISE_S = 0.025;
const CLACK_DECAY_S = 0.03;
const THUNK_NOISE_S = 0.09;
const BELL_DECAY_S = 1.4;
const BELL_PARTIALS: ReadonlyArray<readonly [number, number]> = [
  [1320, 1],
  [3168, 0.5],
  [5148, 0.25],
];

/** Deterministic noise in [-1, 1) from a fixed-seed LCG. */
function fillNoise(data: Float32Array): void {
  let s = 123456789;
  for (let i = 0; i < data.length; i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    data[i] = (s / 4294967296) * 2 - 1;
  }
}

export function createSound(deps: SoundDeps, masterGain?: number): Sound {
  let ctx: AudioContextLike | undefined;
  let master: GainNodeLike | undefined;
  let muted = true;
  let recent: number[] = [];

  const masterValue = (): number => {
    const v = masterGain ?? MASTER_GAIN_MAX;
    if (!Number.isFinite(v)) return MASTER_GAIN_MAX;
    return Math.max(0, Math.min(v, MASTER_GAIN_MAX));
  };

  const resume = (c: AudioContextLike): void => {
    try {
      const r = c.resume();
      if (r && typeof (r as Promise<void>).then === "function") {
        (r as Promise<void>).then(undefined, () => undefined);
      }
    } catch {
      // stay silent
    }
  };

  const unlock = (): void => {
    try {
      if (ctx !== undefined) {
        resume(ctx);
        return;
      }
      if (typeof deps.createContext !== "function") return;
      const c = deps.createContext();
      if (c === undefined || c === null) return;
      const m = c.createGain();
      m.gain.value = masterValue();
      m.connect(c.destination);
      ctx = c;
      master = m;
      resume(c);
    } catch {
      ctx = undefined;
      master = undefined;
    }
  };

  const noiseSource = (
    c: AudioContextLike,
    seconds: number,
  ): BufferSourceNodeLike => {
    const length = Math.max(1, Math.round(c.sampleRate * seconds));
    const buf = c.createBuffer(1, length, c.sampleRate);
    fillNoise(buf.getChannelData(0));
    const src = c.createBufferSource();
    src.buffer = buf;
    return src;
  };

  const voiceGain = (
    c: AudioContextLike,
    peak: number,
    floor: number,
    t0: number,
    decayS: number,
  ): GainNodeLike => {
    const g = c.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(floor, t0 + decayS);
    return g;
  };

  const noiseVoice = (
    filterType: string,
    freq: number,
    q: number | undefined,
    noiseS: number,
    peak: number,
    floor: number,
    decayS: number,
    stopS: number,
  ): void => {
    const c = ctx;
    const m = master;
    if (c === undefined || m === undefined) return;
    const t0 = c.currentTime;
    const src = noiseSource(c, noiseS);
    const filter = c.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    if (q !== undefined) filter.Q.value = q;
    const g = voiceGain(c, peak, floor, t0, decayS);
    src.connect(filter);
    filter.connect(g);
    g.connect(m);
    src.start(t0);
    src.stop(t0 + stopS);
  };

  const clack = (char: string): void => {
    if (ctx === undefined || muted) return;
    try {
      if (char === "" || char === " " || char === "\n" || char === "\t") return;
      const now = deps.now();
      recent = recent.filter((t) => t > now - 1000);
      if (recent.length >= MAX_CLACKS_PER_SECOND) return;
      recent.push(now);
      const code = char.codePointAt(0) ?? 0;
      noiseVoice(
        "bandpass",
        1800 + (code % 8) * 100,
        1.2,
        CLACK_NOISE_S,
        0.6,
        0.001,
        CLACK_DECAY_S,
        CLACK_DECAY_S,
      );
    } catch {
      // stay silent
    }
  };

  const thunk = (): void => {
    if (ctx === undefined || muted) return;
    try {
      noiseVoice(
        "lowpass",
        220,
        undefined,
        THUNK_NOISE_S,
        0.5,
        0.001,
        THUNK_NOISE_S,
        THUNK_NOISE_S,
      );
    } catch {
      // stay silent
    }
  };

  const bell = (): void => {
    const c = ctx;
    const m = master;
    if (c === undefined || m === undefined || muted) return;
    try {
      const t0 = c.currentTime;
      for (const [freq, peak] of BELL_PARTIALS) {
        const osc = c.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const g = voiceGain(c, peak, 0.0001, t0, BELL_DECAY_S);
        osc.connect(g);
        g.connect(m);
        osc.start(t0);
        osc.stop(t0 + BELL_DECAY_S);
      }
    } catch {
      // stay silent
    }
  };

  return {
    unlock,
    setMuted(value: boolean): void {
      muted = value;
    },
    isMuted: () => muted,
    isUnlocked: () => ctx !== undefined,
    clack,
    thunk,
    bell,
  };
}
