/** Warm/Seagull recordings pinned to Guitoro's 2026-10-05.7bd381 bank.
 * See public/samples/acoustic-seagull/LICENSE.txt for the recording license.
 * The loader and signal processing here are independently implemented.
 */
export interface GuitarSample {
  midi: number
  velLo: number
  velHi: number
  buffer: AudioBuffer
  onset: number
  lead: number
  norm: number
}

interface Manifest {
  sampleRate: number
  codecs: Record<string, { ext: string; primingSamples: number }>
  zones: Array<{ midi: number; layers: Array<{
    velLo: number; velHi: number; files: string[]; voiceDb?: number[]
  }> }>
}

export const dbGain = (db: number) => 10 ** (db / 20)
export const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
const limit = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n))

// K-weight the first 300 ms: this measures perceived loudness without
// destroying the relative timbre of the soft, medium and hard recordings.
export function attackLoudness(data: Float32Array, sampleRate: number, start: number): number {
  const shelfK = Math.tan(Math.PI * 1681.974450955533 / sampleRate)
  const shelfQ = 0.7071752369554196
  const shelfGain = dbGain(3.999843853973347)
  const shelfRoot = shelfGain ** 0.4996667741545416
  const divisor = 1 + shelfK / shelfQ + shelfK * shelfK
  const b = [shelfGain + shelfRoot * shelfK / shelfQ + shelfK * shelfK,
    2 * (shelfK * shelfK - shelfGain), shelfGain - shelfRoot * shelfK / shelfQ + shelfK * shelfK].map(x => x / divisor)
  const a = [2 * (shelfK * shelfK - 1) / divisor, (1 - shelfK / shelfQ + shelfK * shelfK) / divisor]
  const highK = Math.tan(Math.PI * 38.13547087602444 / sampleRate)
  const highDivisor = 1 + highK / 0.5003270373238773 + highK * highK
  const highA = [2 * (highK * highK - 1) / highDivisor,
    (1 - highK / 0.5003270373238773 + highK * highK) / highDivisor]
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0, energy = 0
  const end = Math.min(data.length, start + Math.round(sampleRate * 0.3))
  for (let i = start; i < end; i++) {
    const x = data[i]!
    const y = b[0]! * x + b[1]! * x1 + b[2]! * x2 - a[0]! * y1 - a[1]! * y2
    const z = y - 2 * y1 + y2 - highA[0]! * z1 - highA[1]! * z2
    x2 = x1; x1 = x; y2 = y1; y1 = y; z2 = z1; z1 = z
    energy += z * z
  }
  return Math.sqrt(energy / Math.max(1, end - start))
}

export function sampleAttack(buffer: AudioBuffer, priming: number): { onset: number; lead: number; rms: number } {
  const data = buffer.getChannelData(0)
  const rate = buffer.sampleRate
  const end = Math.min(data.length, Math.round(rate * 0.12))
  const preroll = Math.round(rate * 0.0005)
  let peak = 0
  for (let i = 0; i < end; i++) peak = Math.max(peak, Math.abs(data[i]!))
  let start = 0
  if (peak >= 0.002) {
    const hint = Math.max(0, priming - preroll)
    let initialPeak = 0
    for (let i = 0; i < Math.min(hint, end); i++) initialPeak = Math.max(initialPeak, Math.abs(data[i]!))
    if (priming < end && initialPeak < peak * 0.3) start = hint
    for (let i = start; i < end; i++) {
      if (Math.abs(data[i]!) >= Math.max(0.002, peak * 0.02)) {
        start = Math.max(start, i - preroll)
        break
      }
    }
  }
  let attackPeak = 0
  const attackEnd = Math.min(data.length, start + Math.round(rate * 0.12))
  for (let i = start; i < attackEnd; i++) attackPeak = Math.max(attackPeak, Math.abs(data[i]!))
  let lead = 0
  const step = Math.max(1, preroll)
  for (let i = start; i < attackEnd && attackPeak > 0; i += step) {
    let peak = 0
    for (let j = i; j < Math.min(attackEnd, i + step); j++) peak = Math.max(peak, Math.abs(data[j]!))
    if (peak >= attackPeak / 2) { lead = Math.max(0, (i - start) / rate - 0.001); break }
  }
  return { onset: start / rate, lead, rms: attackLoudness(data, rate, start) }
}

export async function loadWarmGuitar(ctx: AudioContext, base: string): Promise<GuitarSample[]> {
  const response = await fetch(`${base}manifest.json`)
  if (!response.ok) throw new Error(`Guitar manifest: HTTP ${response.status}`)
  const manifest: Manifest = await response.json()
  const jobs = manifest.zones.flatMap(zone => zone.layers.flatMap(layer => layer.files.map((file, i) => ({
    midi: zone.midi, velLo: layer.velLo, velHi: layer.velHi, file, voiceDb: layer.voiceDb?.[i] ?? 0
  }))))
  const samples: Array<GuitarSample & { rms: number; voiceDb: number }> = []
  let next = 0
  // Bound fetch/decode concurrency so the full bank doesn't stall mobile audio.
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++]!
      let decoded: { buffer: AudioBuffer; priming: number } | undefined
      for (const codec of ['opus', 'aac']) {
        try {
          const format = manifest.codecs[codec]!
          const response = await fetch(`${base}${job.file}${format.ext}`)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const buffer = await ctx.decodeAudioData(await response.arrayBuffer())
          decoded = { buffer, priming: Math.round(format.primingSamples * buffer.sampleRate / manifest.sampleRate) }
          break
        } catch (error) {
          if (codec === 'aac') throw new Error(`Could not load guitar sample ${job.file}: ${String(error)}`)
        }
      }
      if (!decoded) throw new Error(`Missing guitar sample ${job.file}`)
      samples.push({ ...job, buffer: decoded.buffer, ...sampleAttack(decoded.buffer, decoded.priming), norm: 1 })
    }
  }))
  for (const upper of new Set(samples.map(sample => sample.velHi))) {
    const layer = samples.filter(sample => sample.velHi === upper)
    const levels = layer.map(sample => sample.rms).filter(rms => rms > 0.00001).sort((a, b) => a - b)
    const middle = Math.floor(levels.length / 2)
    const median = levels.length % 2 ? levels[middle]! : ((levels[middle - 1] ?? 0) + (levels[middle] ?? 0)) / 2
    const bankGain = median > 0 ? dbGain(limit(20 * Math.log10(0.158 / median), -24, 24)) : 1
    for (const sample of layer) {
      const trim = median > 0 && sample.rms > 0.00001 ? dbGain(limit(20 * Math.log10(median / sample.rms), -12, 12)) : 1
      sample.norm = bankGain * trim * dbGain(sample.voiceDb)
    }
  }
  return samples.sort((a, b) => a.midi - b.midi || a.velLo - b.velLo)
}
