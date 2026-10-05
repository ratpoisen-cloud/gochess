export type BlastParticleKind = 'core' | 'spark' | 'smoke' | 'debris'

export interface BlastParticle {
  kind: BlastParticleKind
  x: number
  y: number
  size: number
  vx: number
  vy: number
  age: number
  life: number
  gravity: number
  drag: number
  colors: string[]
  colorStep: number
  spin: number
  spinSpeed: number
  grow: number
}

export interface BlastRing {
  x: number
  y: number
  age: number
  life: number
  fromRadius: number
  toRadius: number
  thickness: number
  colors: string[]
  dotSpacing: number
}

export interface PixelBlast {
  particles: BlastParticle[]
  rings: BlastRing[]
  durationMs: number
}

export interface PixelBlastOptions {
  x: number
  y: number
  squareSize: number
  seed?: number
}

export const CORE_COLORS = ['#ffffff', '#fffbe8', '#ffe9a8']
export const SPARK_COLORS = ['#ffffff', '#fff4a3', '#ffd24a', '#ff9a1f', '#f2501f', '#8c1c0d']
export const SMOKE_COLORS = ['#7a7a7a', '#565656', '#3a3a3a', '#242424']
export const DEBRIS_COLORS = ['#ffd24a', '#f2501f', '#8c1c0d']
export const RING_COLORS = ['#ffffff', '#ffd24a', '#ff9a1f', '#f2501f']

const REFERENCE_SQUARE = 60
const PIXEL_UNIT = 4

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function snap(value: number): number {
  return Math.max(PIXEL_UNIT, Math.round(value / PIXEL_UNIT) * PIXEL_UNIT)
}

export function createPixelBlast(options: PixelBlastOptions): PixelBlast {
  const { x, y, squareSize, seed } = options
  const size = Math.max(PIXEL_UNIT * 2, squareSize)
  const scale = size / REFERENCE_SQUARE
  const rand = mulberry32(seed ?? Math.floor(Math.random() * 0xffffffff))

  const particles: BlastParticle[] = []
  const rings: BlastRing[] = []

  const sparkCount = Math.round(46 * scale)
  const smokeCount = Math.round(14 * scale)
  const debrisCount = Math.round(10 * scale)

  particles.push({
    kind: 'core',
    x,
    y,
    size: snap(size * 0.34),
    vx: 0,
    vy: 0,
    age: 0,
    life: 150,
    gravity: 0,
    drag: 1,
    colors: CORE_COLORS,
    colorStep: 0,
    spin: 0,
    spinSpeed: 0,
    grow: size * 0.5
  })

  const innerRingThickness = Math.max(2, Math.round(snap(size * 0.12)))
  const outerRingThickness = Math.max(2, Math.round(snap(size * 0.07)))

  rings.push({
    x,
    y,
    age: 0,
    life: 300,
    fromRadius: size * 0.1,
    toRadius: size * 1.55,
    thickness: innerRingThickness,
    colors: RING_COLORS,
    dotSpacing: innerRingThickness * 0.85
  })

  rings.push({
    x,
    y,
    age: 0,
    life: 430,
    fromRadius: size * 0.1,
    toRadius: size * 1.95,
    thickness: outerRingThickness,
    colors: RING_COLORS,
    dotSpacing: outerRingThickness * 0.85
  })

  for (let i = 0; i < sparkCount; i++) {
    const angle = rand() * Math.PI * 2
    const speed = (70 + rand() * 240) * scale
    particles.push({
      kind: 'spark',
      x: x + (rand() - 0.5) * size * 0.12,
      y: y + (rand() - 0.5) * size * 0.12,
      size: rand() < 0.72 ? PIXEL_UNIT * 1 : PIXEL_UNIT * 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: -rand() * 90,
      life: 340 + rand() * 340,
      gravity: 210,
      drag: 0.86,
      colors: SPARK_COLORS,
      colorStep: Math.floor(rand() * SPARK_COLORS.length),
      spin: rand() * Math.PI * 2,
      spinSpeed: (rand() - 0.5) * 6,
      grow: 0
    })
  }

  for (let i = 0; i < smokeCount; i++) {
    const angle = rand() * Math.PI * 2
    const speed = (14 + rand() * 52) * scale
    particles.push({
      kind: 'smoke',
      x: x + Math.cos(angle) * size * 0.16,
      y: y + Math.sin(angle) * size * 0.16,
      size: snap(size * (0.1 + rand() * 0.12)),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 26 * scale,
      age: -rand() * 170,
      life: 620 + rand() * 420,
      gravity: -34,
      drag: 0.9,
      colors: SMOKE_COLORS,
      colorStep: Math.floor(rand() * SMOKE_COLORS.length),
      spin: rand() * Math.PI * 2,
      spinSpeed: (rand() - 0.5) * 1.4,
      grow: 9 * scale
    })
  }

  for (let i = 0; i < debrisCount; i++) {
    const angle = rand() * Math.PI * 2
    const speed = (110 + rand() * 190) * scale
    particles.push({
      kind: 'debris',
      x,
      y,
      size: rand() < 0.5 ? PIXEL_UNIT : PIXEL_UNIT * 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40 * scale,
      age: -rand() * 60,
      life: 520 + rand() * 380,
      gravity: 460,
      drag: 0.93,
      colors: DEBRIS_COLORS,
      colorStep: Math.floor(rand() * DEBRIS_COLORS.length),
      spin: rand() * Math.PI * 2,
      spinSpeed: (rand() - 0.5) * 9,
      grow: 0
    })
  }

  const longestLife = particles.reduce((max, p) => Math.max(max, p.life), 0)
  const longestRing = rings.reduce((max, r) => Math.max(max, r.life), 0)

  return {
    particles,
    rings,
    durationMs: Math.ceil(Math.max(longestLife, longestRing) + 120)
  }
}

export function particleColor(particle: BlastParticle): string {
  const progress = particle.life > 0 ? particle.age / particle.life : 1
  const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress
  const heat = clamped * (particle.colors.length - 1)
  const base = Math.floor(heat)
  const flicker = (base + particle.colorStep + Math.floor(particle.age / 26)) % particle.colors.length
  return particle.colors[(flicker + particle.colors.length) % particle.colors.length]
}

export function ringColor(ring: BlastRing): string {
  const progress = ring.life > 0 ? ring.age / ring.life : 1
  const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress
  const index = Math.floor(clamped * (ring.colors.length - 1))
  return ring.colors[Math.max(0, Math.min(ring.colors.length - 1, index))]
}

export function ringRadius(ring: BlastRing): number {
  const raw = ring.life > 0 ? ring.age / ring.life : 1
  const progress = raw < 0 ? 0 : raw > 1 ? 1 : raw
  return ring.fromRadius + (ring.toRadius - ring.fromRadius) * progress
}

export function ringDots(ring: BlastRing): Array<{ x: number; y: number }> {
  const radius = ringRadius(ring)
  const dots: Array<{ x: number; y: number }> = []
  const steps = Math.max(16, Math.min(160, Math.round((Math.PI * 2 * radius) / ring.dotSpacing)))
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    dots.push({
      x: Math.round(ring.x + Math.cos(angle) * radius),
      y: Math.round(ring.y + Math.sin(angle) * radius)
    })
  }
  return dots
}

const MAX_STEP_SECONDS = 1 / 120

export function stepParticle(particle: BlastParticle, dtSeconds: number): boolean {
  let remaining = dtSeconds

  while (remaining > 0) {
    const dt = Math.min(remaining, MAX_STEP_SECONDS)
    remaining -= dt

    particle.age += dt * 1000
    if (particle.age < 0) continue
    if (particle.age >= particle.life) return false

    const drag = Math.pow(particle.drag, dt * 60)
    particle.vx *= drag
    particle.vy = particle.vy * drag + particle.gravity * dt
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.spin += particle.spinSpeed * dt
    if (particle.grow > 0) particle.size = snap(particle.size + particle.grow * dt)
  }

  return true
}

export function stepRing(ring: BlastRing, dtSeconds: number): boolean {
  ring.age += dtSeconds * 1000
  return ring.age < ring.life
}

export function particleAlpha(particle: BlastParticle): number {
  const age = particle.age < 0 ? 0 : particle.age
  const fadeIn = Math.min(1, age / 40)
  const fadeOut = Math.max(0, 1 - Math.max(0, age - (particle.life - 120)) / 120)
  return Math.max(0, Math.min(1, fadeIn * fadeOut))
}