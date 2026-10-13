import { OPEN_STRING_MIDI } from '../utils/noteNames'
import { loadWarmGuitar, dbGain, frequency, type GuitarSample } from './warmGuitar'
import { createGuitarEffects } from './guitarEffects'

/**
 * Sample-based guitar engine built directly on the Web Audio API.
 *
 * Realism comes from modelling the instrument per string rather than per note:
 * - Every string owns at most one sounding voice. Replucking a string (or
 *   changing the fret) damps the previous voice, like a real pick does.
 * - Notes are never cut at a fixed duration. The recording decays naturally
 *   until the string is explicitly released, muted or replucked.
 * - Releases use exponential gain envelopes (setTargetAtTime) with a closing
 *   low-pass filter, so damped strings fade darker rather than clicking off.
 * - Velocity drives both loudness and brightness, and small random variations
 *   in timing, strength and tuning keep repeated notes from sounding robotic.
 *
 * The engine is framework-agnostic (no Vue). All timing parameters are
 * AudioContext times so callers can schedule ahead precisely.
 */

// Release time constants (seconds). A fade reaches ~5% amplitude after 3τ.
const TAU_RELEASE_FRETTED = 0.18 // lifting a fretting finger
const TAU_RELEASE_OPEN = 0.4     // open string touched lightly when the hand moves
const TAU_PALM_MUTE = 0.16       // palm resting on the strings near the bridge
const TAU_MUTE = 0.03            // deliberate hand mute
const TAU_STOP = 0.05            // global stop

interface Voice {
  source: AudioBufferSourceNode
  filter: BiquadFilterNode
  gain: GainNode
  comb: DelayNode
  combGain: GainNode
  fret: number
  startTime: number
  cutoff: number
}

export interface PluckOptions {
  /** 0..1 playing strength (default 0.7) */
  velocity?: number
  /** AudioContext time to play at (default: now) */
  when?: number
  palmMute?: boolean
  /** Finger contact has a softer attack than a pick. */
  fingers?: boolean
  /** Sample-layer selector, independent of output volume. */
  takeVelocity?: number
  /** Internal stroke envelope; individual plucks leave this off. */
  strummed?: boolean
}

export interface StrumOptions {
  direction?: 'down' | 'up'
  velocity?: number
  when?: number
  palmMute?: boolean
  /** Seconds between adjacent strings; defaults to a velocity-dependent value */
  spread?: number
}

export interface StringFret {
  string: number
  fret: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, Math.random()))) * Math.cos(2 * Math.PI * Math.random())
const jitter = (amount: number) => (Math.random() * 2 - 1) * amount

export class GuitarEngine {
  /** 0 = perfectly mechanical, 1 = natural human variation */
  humanize = 1

  private ctx: AudioContext | null = null
  private input: GainNode | null = null
  private samples: GuitarSample[] = []
  private loadPromise: Promise<void> | null = null
  private voices = new Map<number, Voice>()
  private allVoices = new Set<Voice>()
  private repeats = new Map<number, { midi: number; count: number }>()

  get isLoaded(): boolean {
    return this.samples.length > 0
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0
  }

  /**
   * Creates/resumes the AudioContext and loads samples. Call this from a user
   * gesture handler: the context is created and resumed synchronously before
   * the first await, which satisfies browser autoplay policies.
   */
  async ensureReady(): Promise<void> {
    const ctx = this.getContext()
    const resumed = ctx.state === 'running' ? Promise.resolve() : ctx.resume()
    await Promise.all([resumed, this.load()])
  }

  /** Plays one string. Any note still ringing on that string is damped. */
  pluck(string: number, fret: number, options: PluckOptions = {}): void {
    const ctx = this.ctx
    if (!ctx || !this.input || !this.isLoaded) {
      console.warn('GuitarEngine: not ready, call ensureReady() first')
      return
    }
    const open = OPEN_STRING_MIDI[string]
    if (open === undefined) return

    const h = clamp(this.humanize, 0, 1)
    const requested = options.when ?? ctx.currentTime
    // Callers own the timeline. Jittering each absolute timestamp can reverse
    // adjacent strings in a strum or disturb a scheduled picking pattern.
    const when = Math.max(ctx.currentTime, requested)
    const velocity = clamp(options.velocity ?? 0.7, 0, 1)

    const midi = open + fret
    const repeated = this.repeats.get(string)
    const count = repeated?.midi === midi ? repeated.count + 1 : 0
    this.repeats.set(string, { midi, count })
    // Warm uses a medium take for single plucks; timbre is not selected by
    // simply comparing output velocity with the manifest boundaries.
    const takeVelocity = clamp(options.takeVelocity ?? 0.57, 0, 1)
    const alternate = !options.strummed && h > 0 ? [0, 1, 0, -1][count % 4]! : 0
    const sample = this.findSample(midi + alternate, takeVelocity)

    // Stop whatever this string was doing at the moment the new note starts
    const previous = this.voices.get(string)
    if (previous) this.releaseVoice(previous, when, clamp(1.5 / frequency(midi), 0.006, 0.02))

    const source = ctx.createBufferSource()
    source.buffer = sample.buffer
    source.playbackRate.value = Math.pow(2, (midi - sample.midi) / 12)
    source.detune.value = gaussian() * h

    let cutoff = Math.min(20000, Math.max(1200 * 15 ** Math.min(1, velocity / sample.velHi), frequency(midi) * 4))
    cutoff = clamp(cutoff * Math.exp(0.15 * gaussian() * h), 300, 20000)
    const softStroke = options.strummed ? Math.max(0, (0.5 - velocity) / 0.5) : 0
    cutoff *= Math.exp(-1.6 * softStroke) * (options.fingers ? 0.6 : 1)
    if (options.palmMute) cutoff = Math.min(cutoff, 1500 + 1000 * clamp((velocity - 0.3) / 0.7, 0, 1))

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = -3
    filter.frequency.value = cutoff

    const combPosition = options.fingers ? 0.22 + Math.random() * 0.06 : 0.1 + Math.random() * 0.1
    const combDepth = (options.fingers ? 0.2 + Math.random() * 0.2 : 0.1 + Math.random() * 0.2) * h
    const phase = 2 * Math.PI * combPosition
    const combNorm = 1 / Math.sqrt(Math.hypot(1 - combDepth * Math.cos(phase), combDepth * Math.sin(phase)) * Math.sqrt(1 + combDepth * combDepth))
    const bassWeight = dbGain(3 * clamp((57 - midi) / 17, 0, 1))
    const pitchWeight = dbGain(clamp((sample.midi - midi - 2) * 0.5, 0, 3))
    const level = 0.5 * sample.norm * dbGain(-24 * (1 - velocity)) * bassWeight * pitchWeight * combNorm
    const gain = ctx.createGain()
    const rate = source.playbackRate.value
    const lead = sample.lead / rate
    const sourceStart = Math.max(ctx.currentTime, when - lead)
    const offset = Math.min(sample.buffer.duration - 0.001, sample.onset + Math.max(0, ctx.currentTime - (when - lead)) * rate)
    let attack = options.strummed ? Math.min(0.001 + Math.random() * 0.001 * h, lead) : 0
    if (softStroke > 0 || options.fingers) attack = Math.max(attack, lead + Math.max(0.02 * softStroke, options.fingers ? 0.005 : 0))
    if (attack > 0) {
      gain.gain.setValueAtTime(0, sourceStart)
      gain.gain.linearRampToValueAtTime(level, sourceStart + attack)
    } else gain.gain.setValueAtTime(level, sourceStart)
    if (options.strummed && !options.palmMute) gain.gain.setTargetAtTime(level * dbGain(-1.5), when + 0.015, 0.05)
    if (options.palmMute) {
      gain.gain.setTargetAtTime(0, when + 0.015, TAU_PALM_MUTE)
    }

    // Pick-position comb filtering. Guitoro's dry guitar is centered; its
    // room response supplies width, rather than panning individual strings.
    const comb = ctx.createDelay(0.05)
    comb.delayTime.value = Math.min(0.05, combPosition / frequency(midi))
    const combGain = ctx.createGain()
    combGain.gain.value = -combDepth
    source.connect(filter).connect(gain).connect(this.input)
    filter.connect(comb).connect(combGain).connect(gain)

    const voice: Voice = { source, filter, gain, comb, combGain, fret, startTime: sourceStart, cutoff }
    source.onended = () => this.disposeVoice(string, voice)
    source.start(sourceStart, Math.max(0, offset))
    if (options.palmMute) source.stop(when + 0.02 + TAU_PALM_MUTE * 6)

    this.voices.set(string, voice)
    this.allVoices.add(voice)
  }

  /**
   * Strums several strings with a natural stagger. `strings` may be in any
   * order; they are sorted by direction (down = low E first).
   */
  strum(strings: StringFret[], options: StrumOptions = {}): void {
    const ctx = this.ctx
    if (!ctx) return
    const direction = options.direction ?? 'down'
    const velocity = options.velocity ?? 0.75
    const start = Math.max(ctx.currentTime, options.when ?? ctx.currentTime + 0.01)
    // Harder strums travel across the strings faster
    const spread = Math.max(0, options.spread ?? 0.035 - 0.015 * clamp(velocity, 0, 1))

    const ordered = [...strings].sort((a, b) =>
      direction === 'down' ? b.string - a.string : a.string - b.string
    )
    let when = start
    ordered.forEach((sf, i) => {
      // Vary the gap, not the total offset: every string follows the last.
      // Account for crossing omitted (muted) strings too.
      if (i > 0) {
        const distance = Math.abs(sf.string - ordered[i - 1]!.string)
        when += distance * spread * (1 + jitter(0.2 * clamp(this.humanize, 0, 1)))
      }
      // Down strums lean on the bass, up strums lean on the treble
      const emphasis = direction === 'down'
        ? 1 - 0.04 * i
        : 1 - 0.07 * i
      this.pluck(sf.string, sf.fret, {
        when,
        velocity: velocity * emphasis,
        palmMute: options.palmMute,
        takeVelocity: spread <= 0.007 ? 0.87 : 0.57,
        strummed: true
      })
    })
  }

  /**
   * Lets go of a string the way lifting a finger does: fretted notes stop
   * quickly, open strings fade more slowly.
   */
  release(string: number, when?: number): void {
    const voice = this.voices.get(string)
    if (!voice || !this.ctx) return
    const tau = voice.fret === 0 ? TAU_RELEASE_OPEN : TAU_RELEASE_FRETTED
    this.releaseVoice(voice, when ?? this.ctx.currentTime, tau)
    this.voices.delete(string)
  }

  /** Mutes a string firmly with the hand. */
  mute(string: number, when?: number): void {
    const voice = this.voices.get(string)
    if (!voice || !this.ctx) return
    this.releaseVoice(voice, when ?? this.ctx.currentTime, TAU_MUTE)
    this.voices.delete(string)
  }

  /** Silences everything, including notes scheduled in the future. */
  stopAll(): void {
    const ctx = this.ctx
    if (!ctx) return
    const now = ctx.currentTime
    for (const voice of this.allVoices) {
      if (voice.startTime > now) {
        voice.source.stop(now)
      } else {
        this.releaseVoice(voice, now, TAU_STOP)
      }
    }
    this.voices.clear()
  }

  private getContext(): AudioContext {
    if (this.ctx) return this.ctx
    const ctx = new AudioContext({ latencyHint: 'interactive' })

    const input = createGuitarEffects(ctx)

    this.ctx = ctx
    this.input = input
    return ctx
  }

  private load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = loadWarmGuitar(this.getContext(), `${import.meta.env?.BASE_URL ?? '/'}samples/acoustic-seagull/`).then(samples => { this.samples = samples }).catch(error => {
        this.loadPromise = null // allow retry
        throw error
      })
    }
    return this.loadPromise
  }

  private findSample(midi: number, takeVelocity: number): GuitarSample {
    const layer = this.samples.filter(s => takeVelocity >= s.velLo && (takeVelocity < s.velHi || s.velHi === 1))
    let best = layer[0]!
    for (const sample of layer) {
      const distance = Math.abs(sample.midi - midi)
      const bestDistance = Math.abs(best.midi - midi)
      if (distance < bestDistance || (distance === bestDistance && sample.midi > best.midi)) best = sample
    }
    return best
  }

  private releaseVoice(voice: Voice, when: number, tau: number): void {
    // Stay just after the note's own start event so cancelScheduledValues
    // doesn't wipe the initial level
    const start = Math.max(when, voice.startTime + 0.005)
    voice.gain.gain.cancelScheduledValues(start)
    voice.gain.gain.setTargetAtTime(0, start, tau)
    // Damping removes high harmonics first
    voice.filter.frequency.cancelScheduledValues(start)
    voice.filter.frequency.setTargetAtTime(Math.min(voice.cutoff, 700), start, tau)
    try {
      voice.source.stop(start + tau * 6)
    } catch {
      // Already stopped
    }
  }

  private disposeVoice(string: number, voice: Voice): void {
    voice.source.disconnect()
    voice.filter.disconnect()
    voice.gain.disconnect()
    voice.comb.disconnect()
    voice.combGain.disconnect()
    this.allVoices.delete(voice)
    if (this.voices.get(string) === voice) this.voices.delete(string)
  }
}

/** Shared engine so every view reuses one AudioContext and one sample cache. */
export const guitarEngine = new GuitarEngine()
