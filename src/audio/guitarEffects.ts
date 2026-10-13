import { dbGain } from './warmGuitar'

// Seeded Mulberry32 PRNG keeps a room impulse stable across sessions.
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let word = Math.imul(state ^ (state >>> 15), state | 1)
    word ^= word + Math.imul(word ^ (word >>> 7), word | 61)
    return ((word ^ (word >>> 14)) >>> 0) / 4294967296
  }
}

function roomImpulse(ctx: AudioContext, seconds: number, bright: number, dark: number, seed: number): AudioBuffer {
  const rate = ctx.sampleRate
  const preDelay = Math.round(0.006 * rate)
  const tail = Math.round(seconds * rate)
  const buffer = ctx.createBuffer(2, preDelay + tail, rate)
  for (let channel = 0; channel < 2; channel++) {
    const noise = random(seed * 2 + channel + 1)
    const data = buffer.getChannelData(channel)
    let filtered = 0
    for (let i = 0; i < tail; i++) {
      const cutoff = bright * (dark / bright) ** (i / tail)
      filtered += (1 - Math.exp(-2 * Math.PI * cutoff / rate)) * (2 * noise() - 1 - filtered)
      data[preDelay + i] = filtered * Math.exp(-6.907755 * i / (seconds * rate)) * Math.min(1, i / Math.max(1, Math.round(0.003 * rate)))
    }
  }
  return buffer
}

/** Default Warm signal path: body EQ, short room bloom, 15% room reverb,
 * master 0.8 (+1 dB trim), +2 dB limiter drive, soft output saturation.
 */
export function createGuitarEffects(ctx: AudioContext): GainNode {
  const input = ctx.createGain()
  let output: AudioNode = input
  const stages: Array<[BiquadFilterType, number, number, number]> = [
    ['highpass', 60, -3, 0], ['peaking', 110, 1, 2],
    ['peaking', 200, 1, 1.5], ['peaking', 350, 1, -0.75],
    ['peaking', 3000, 0.8, 1.5], ['highshelf', 10000, 0.7, 1]
  ]
  for (const [type, hz, q, db] of stages) {
    const filter = ctx.createBiquadFilter()
    filter.type = type; filter.frequency.value = hz; filter.Q.value = q; filter.gain.value = db
    output.connect(filter)
    output = filter
  }
  const post = ctx.createGain()
  output.connect(post)
  const bloomSend = ctx.createGain()
  bloomSend.gain.value = dbGain(-15)
  const bloom = ctx.createConvolver()
  bloom.buffer = roomImpulse(ctx, 0.3, 10000, 3500, 5)
  output.connect(bloomSend).connect(bloom).connect(post)

  const room = ctx.createConvolver()
  room.buffer = roomImpulse(ctx, 1.2, 9000, 2500, 7)
  const wet = ctx.createGain()
  wet.gain.value = 0.15
  const dry = ctx.createGain()
  dry.gain.value = 1 - 0.15 * 0.3
  const master = ctx.createGain()
  master.gain.value = 0.8 * dbGain(1)
  post.connect(dry).connect(master)
  post.connect(room).connect(wet).connect(master)

  const drive = ctx.createGain()
  drive.gain.value = dbGain(2)
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -3
  compressor.knee.value = 2
  compressor.ratio.value = 20
  compressor.attack.value = 0.002
  compressor.release.value = 0.15
  const saturator = ctx.createWaveShaper()
  const curve = new Float32Array(2049)
  for (let i = 0; i < curve.length; i++) {
    const x = i * 2 / (curve.length - 1) - 1
    const magnitude = Math.abs(x)
    curve[i] = Math.sign(x) * (magnitude <= 0.8 ? magnitude : 0.8 + 0.2 * Math.tanh((magnitude - 0.8) / 0.2))
  }
  saturator.curve = curve
  saturator.oversample = 'none'
  master.connect(drive).connect(compressor).connect(saturator).connect(ctx.destination)
  return input
}
