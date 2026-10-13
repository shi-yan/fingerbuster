import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

// Compile the framework-free engine in memory; no browser or audio download
// is needed to verify what gets scheduled on the Web Audio clock.
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
).toString('base64')
const notes = moduleUrl(await readFile(new URL('../src/utils/noteNames.ts', import.meta.url), 'utf8'))
const warm = moduleUrl(await readFile(new URL('../src/audio/warmGuitar.ts', import.meta.url), 'utf8'))
const effects = moduleUrl((await readFile(new URL('../src/audio/guitarEffects.ts', import.meta.url), 'utf8')).replace("'./warmGuitar'", JSON.stringify(warm)))
const source = (await readFile(new URL('../src/audio/guitarEngine.ts', import.meta.url), 'utf8'))
  .replace("'../utils/noteNames'", JSON.stringify(notes))
  .replace("'./warmGuitar'", JSON.stringify(warm))
  .replace("'./guitarEffects'", JSON.stringify(effects))
const { GuitarEngine } = await import(moduleUrl(source))

function strumRecorder(humanize = 0) {
  const engine = new GuitarEngine()
  engine.ctx = { currentTime: 10 }
  engine.humanize = humanize
  const events = []
  engine.pluck = (string, fret, options) => events.push({ string, fret, ...options })
  return { engine, events }
}
const chord = [1, 4, 6, 2, 5, 3].map(string => ({ string, fret: 0 }))

test('down and up sweeps preserve physical order and explicit audio time', () => {
  for (const direction of ['down', 'up']) {
    const { engine, events } = strumRecorder()
    engine.strum(chord, { direction, when: 12, spread: 0.025 })
    assert.deepEqual(events.map(e => e.string), direction === 'down' ? [6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6])
    assert.equal(events[0].when, 12)
    events.forEach((event, i) => assert.ok(Math.abs(event.when - (12 + i * 0.025)) < 1e-9))
    assert.ok(events[0].velocity > events.at(-1).velocity)
  }
})

test('humanization cannot reverse strings, even with alternating extremes', () => {
  const random = Math.random
  let count = 0
  Math.random = () => count++ % 2 ? 0 : 1
  try {
    const { engine, events } = strumRecorder(1)
    engine.strum(chord)
    for (let i = 1; i < events.length; i++) {
      const gap = events[i].when - events[i - 1].when
      assert.ok(gap >= 0.018 && gap <= 0.029)
    }
  } finally {
    Math.random = random
  }
})

test('crossing a muted string takes time without playing it', () => {
  const { engine, events } = strumRecorder()
  engine.strum([{ string: 6, fret: 3 }, { string: 4, fret: 0 }], { when: 12, spread: 0.025 })
  assert.equal(events.length, 2)
  assert.ok(Math.abs(events[1].when - events[0].when - 0.05) < 1e-9)
})

test('replucks damp the previous voice and Stop cancels queued notes', () => {
  const starts = []
  const sources = []
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} })
  const node = () => ({ connect(target) { return target }, disconnect() {} })
  const engine = new GuitarEngine()
  engine.humanize = 0
  engine.input = node()
  engine.samples = [{ midi: 40, velLo: 0.4, velHi: 0.75, buffer: { duration: 8 }, onset: 0.003, lead: 0, norm: 1 }]
  engine.ctx = {
    currentTime: 10,
    createBufferSource() {
      const source = { ...node(), playbackRate: param(), detune: param(), stops: [],
        start(...args) { starts.push(args) }, stop(when) { this.stops.push(when) } }
      sources.push(source)
      return source
    },
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), Q: param(), frequency: param() }),
    createDelay: () => ({ ...node(), delayTime: param() })
  }
  engine.pluck(6, 0, { when: 11 })
  engine.pluck(6, 3, { when: 12 })
  assert.deepEqual(starts, [[11, 0.003], [12, 0.003]])
  assert.ok(sources[0].stops[0] > 12 && sources[0].stops[0] < 12.1)
  engine.stopAll()
  assert.equal(sources[0].stops.at(-1), 10)
  assert.equal(sources[1].stops.at(-1), 10)
})

test('velocity layers use the exact Warm boundaries and higher pitches win ties', () => {
  const engine = new GuitarEngine()
  engine.samples = [40, 42].flatMap(midi => [[0, 0.4], [0.4, 0.75], [0.75, 1]].map(([velLo, velHi]) => ({ midi, velLo, velHi })))
  assert.equal(engine.findSample(40, 0.399).velHi, 0.4)
  assert.equal(engine.findSample(40, 0.4).velHi, 0.75)
  assert.equal(engine.findSample(40, 0.75).velHi, 1)
  assert.equal(engine.findSample(41, 0.57).midi, 42)
})

test('bundled Warm bank contains every pinned note in both codecs', async () => {
  const { createHash } = await import('node:crypto')
  const root = new URL('../public/samples/acoustic-seagull/', import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'))
  const sums = new Map((await readFile(new URL('SHA256SUMS', root), 'utf8')).trim().split('\n').map(line => {
    const [hash, name] = line.split('  ')
    return [name, hash]
  }))
  assert.equal(manifest.zones.length, 45)
  for (const zone of manifest.zones) for (const layer of zone.layers) for (const file of layer.files) {
    for (const extension of ['.ogg', '.m4a']) {
      const name = file + extension
      const data = await readFile(new URL(name, root))
      assert.equal(createHash('sha256').update(data).digest('hex'), sums.get(name), name)
    }
  }
})

test('loader retries AAC when Opus decoding fails and keeps layer gains finite', async () => {
  const { loadWarmGuitar } = await import(warm)
  const originalFetch = globalThis.fetch
  const calls = []
  const data = Float32Array.from({ length: 48000 }, (_, i) => i < 100 ? 0 : Math.sin(i * 0.1) * 0.1)
  globalThis.fetch = async url => {
    calls.push(url)
    return { ok: true, json: async () => ({ sampleRate: 48000,
      codecs: { opus: { ext: '.ogg', primingSamples: 0 }, aac: { ext: '.m4a', primingSamples: 1024 } },
      zones: [{ midi: 40, layers: [{ velLo: 0, velHi: 1, files: ['test'], voiceDb: [0] }] }] }),
    arrayBuffer: async () => new Uint8Array([url.endsWith('.ogg') ? 0 : 1]).buffer }
  }
  try {
    const ctx = { decodeAudioData: async bytes => {
      if (new Uint8Array(bytes)[0] === 0) throw new Error('Unsupported codec')
      return { sampleRate: 48000, getChannelData: () => data }
    } }
    const bank = await loadWarmGuitar(ctx, '/samples/')
    assert.deepEqual(calls, ['/samples/manifest.json', '/samples/test.ogg', '/samples/test.m4a'])
    assert.ok(bank[0].norm > 0 && Number.isFinite(bank[0].norm))
    assert.ok(bank[0].onset >= 0 && bank[0].lead >= 0)
  } finally { globalThis.fetch = originalFetch }
})
