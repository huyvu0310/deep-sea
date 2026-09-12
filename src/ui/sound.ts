/**
 * Sound effects, synthesised with the Web Audio API.
 *
 * Generating tones costs nothing to ship and avoids audio files entirely, which
 * matters here because the client is a static bundle behind a strict CSP. Every
 * cue is short and follows a player action, so the browser's autoplay rules are
 * satisfied by the click that caused it.
 */
export type Cue = 'roll' | 'step' | 'scoop' | 'drop' | 'surface' | 'alarm';

const MUTE_KEY = 'deep-sea-muted';

let context: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false; // private browsing can refuse storage; sound is a convenience
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, String(next));
  } catch {
    // Nothing to do; the setting simply will not survive a reload.
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    context ??= new AudioContext();
    // Browsers start the context suspended until a gesture has occurred.
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null; // no audio device, or the API is unavailable
  }
}

/** A single shaped tone. */
function tone(
  ctx: AudioContext,
  {
    type = 'sine',
    from,
    to = from,
    start = 0,
    duration,
    gain = 0.12,
  }: {
    type?: OscillatorType;
    from: number;
    to?: number;
    start?: number;
    duration: number;
    gain?: number;
  },
): void {
  const at = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const level = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + duration);

  // A short fade either side keeps the tone from clicking.
  level.gain.setValueAtTime(0.0001, at);
  level.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  level.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  osc.connect(level).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/** A burst of filtered noise — the rattle of dice on a table. */
function rattle(ctx: AudioContext, start: number, duration: number): void {
  const at = ctx.currentTime + start;
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    const decay = 1 - i / frames;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const shape = ctx.createBiquadFilter();
  shape.type = 'bandpass';
  shape.frequency.value = 1400 + Math.random() * 900;
  shape.Q.value = 1.1;

  const level = ctx.createGain();
  level.gain.value = 0.22;

  source.connect(shape).connect(level).connect(ctx.destination);
  source.start(at);
}

export function play(cue: Cue, index = 0): void {
  const ctx = audio();
  if (!ctx) return;

  switch (cue) {
    case 'roll':
      // Several tumbles, thinning out as the dice come to rest.
      for (let i = 0; i < 7; i++) rattle(ctx, i * 0.12 + Math.random() * 0.03, 0.09);
      tone(ctx, { type: 'triangle', from: 320, to: 200, start: 0.9, duration: 0.16, gain: 0.1 });
      break;
    case 'step':
      // Rises slightly with each space, so a long swim sounds like progress.
      tone(ctx, {
        type: 'sine',
        from: 420 + index * 38,
        duration: 0.1,
        gain: 0.07,
      });
      break;
    case 'scoop':
      tone(ctx, { type: 'triangle', from: 520, to: 900, duration: 0.17, gain: 0.11 });
      break;
    case 'drop':
      tone(ctx, { type: 'triangle', from: 480, to: 220, duration: 0.2, gain: 0.1 });
      break;
    case 'surface':
      tone(ctx, { type: 'sine', from: 523, duration: 0.3, gain: 0.1 });
      tone(ctx, { type: 'sine', from: 659, start: 0.08, duration: 0.3, gain: 0.09 });
      tone(ctx, { type: 'sine', from: 784, start: 0.16, duration: 0.34, gain: 0.09 });
      break;
    case 'alarm':
      tone(ctx, { type: 'square', from: 220, duration: 0.18, gain: 0.05 });
      tone(ctx, { type: 'square', from: 180, start: 0.22, duration: 0.22, gain: 0.05 });
      break;
  }
}
