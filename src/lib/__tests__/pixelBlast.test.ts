import { describe, it, expect } from 'vitest'
import {
  createPixelBlast,
  ringDots,
  ringRadius,
  ringColor,
  particleColor,
  particleAlpha,
  stepParticle,
  stepRing,
  SPARK_COLORS,
  SMOKE_COLORS,
} from '@/lib/pixelBlast'
import type { BlastParticle } from '@/lib/pixelBlast'

const OPT = { x: 200, y: 160, squareSize: 60, seed: 12345 }

describe('createPixelBlast', () => {
  it('builds the four stages of an explosion', () => {
    const blast = createPixelBlast(OPT)
    const kinds = new Set(blast.particles.map(p => p.kind))
    expect(kinds.has('core')).toBe(true)
    expect(kinds.has('spark')).toBe(true)
    expect(kinds.has('smoke')).toBe(true)
    expect(kinds.has('debris')).toBe(true)
    expect(blast.rings).toHaveLength(2)
  })

  it('is deterministic for a given seed', () => {
    const a = createPixelBlast(OPT)
    const b = createPixelBlast(OPT)
    expect(a.particles.map(p => [p.x, p.y, p.vx, p.vy])).toEqual(b.particles.map(p => [p.x, p.y, p.vx, p.vy]))
  })

  it('differs between seeds', () => {
    const a = createPixelBlast({ ...OPT, seed: 1 })
    const b = createPixelBlast({ ...OPT, seed: 2 })
    expect(a.particles.length).toBe(b.particles.length)
    expect(a.particles[1].vx).not.toBe(b.particles[1].vx)
  })

  it('scales particle count with the square size', () => {
    const small = createPixelBlast({ ...OPT, squareSize: 30 })
    const large = createPixelBlast({ ...OPT, squareSize: 120 })
    expect(large.particles.length).toBeGreaterThan(small.particles.length)
  })

  it('keeps every pixel size snapped to the 4px grid', () => {
    const blast = createPixelBlast({ ...OPT, squareSize: 77 })
    for (const p of blast.particles) {
      expect(p.size % 4).toBe(0)
    }
  })

  it('never throws on a degenerate square size', () => {
    expect(() => createPixelBlast({ x: 0, y: 0, squareSize: 0 })).not.toThrow()
    expect(() => createPixelBlast({ x: 0, y: 0, squareSize: -20 })).not.toThrow()
  })

  it('reports a duration that covers its slowest element', () => {
    const blast = createPixelBlast(OPT)
    const longestLife = Math.max(...blast.particles.map(p => p.life), ...blast.rings.map(r => r.life))
    expect(blast.durationMs).toBeGreaterThanOrEqual(longestLife)
  })

  it('starts smoke and sparks staggered, so they do not pop in unison', () => {
    const blast = createPixelBlast(OPT)
    const sparks = blast.particles.filter(p => p.kind === 'spark')
    const smoke = blast.particles.filter(p => p.kind === 'smoke')
    expect(sparks.some(p => p.age < 0)).toBe(true)
    expect(smoke.some(p => p.age < 0)).toBe(true)
  })

  it('gives sparks the widest colour ramp and smoke its own grey ramp', () => {
    const blast = createPixelBlast(OPT)
    const spark = blast.particles.find(p => p.kind === 'spark')!
    const smoke = blast.particles.find(p => p.kind === 'smoke')!
    expect(spark.colors).toEqual(SPARK_COLORS)
    expect(smoke.colors).toEqual(SMOKE_COLORS)
  })
})

describe('rings', () => {
  it('expand from the epicentre outwards', () => {
    const blast = createPixelBlast(OPT)
    const ring = blast.rings[0]
    const start = ringRadius(ring)
    ring.age = ring.life / 2
    const middle = ringRadius(ring)
    ring.age = ring.life
    const end = ringRadius(ring)
    expect(start).toBeLessThan(middle)
    expect(middle).toBeLessThan(end)
  })

  it('cool down as they expand', () => {
    const blast = createPixelBlast(OPT)
    const ring = blast.rings[0]
    expect(ringColor(ring)).toBe('#ffffff')
    ring.age = ring.life
    expect(ringColor(ring)).toBe('#f2501f')
  })

  it('gain dots as they expand, so they read as rings and not polygons', () => {
    const blast = createPixelBlast(OPT)
    const ring = blast.rings[0]
    const atBirth = ringDots(ring).length
    ring.age = ring.life
    const atFull = ringDots(ring).length
    expect(atFull).toBeGreaterThan(atBirth)
    expect(atFull).toBeGreaterThan(40)
  })

  it('keeps every dot the same distance from the centre', () => {
    const blast = createPixelBlast(OPT)
    const ring = blast.rings[0]
    ring.age = ring.life * 0.5
    const radius = ringRadius(ring)
    for (const d of ringDots(ring)) {
      expect(Number.isInteger(d.x)).toBe(true)
      expect(Number.isInteger(d.y)).toBe(true)
      const measured = Math.hypot(d.x - ring.x, d.y - ring.y)
      expect(Math.abs(measured - radius)).toBeLessThan(1.5)
    }
  })

  it('retires a ring once its life is spent', () => {
    const blast = createPixelBlast(OPT)
    const ring = blast.rings[0]
    let alive = stepRing(ring, 0.016)
    while (alive) alive = stepRing(ring, 0.016)
    expect(alive).toBe(false)
  })
})

describe('particles', () => {
  it('cool from white to dark red as they age', () => {
    const blast = createPixelBlast(OPT)
    const spark: BlastParticle = { ...blast.particles.find(p => p.kind === 'spark')!, colorStep: 0 }
    spark.age = 0
    const start = particleColor(spark)
    spark.age = spark.life
    const end = particleColor(spark)
    expect(start).toBe('#ffffff')
    expect(end).not.toBe(start)
  })

  it('flicker rather than fade to a single flat colour', () => {
    const blast = createPixelBlast(OPT)
    const spark: BlastParticle = { ...blast.particles.find(p => p.kind === 'spark')!, colorStep: 0 }
    const seen = new Set<string>()
    for (let t = 0; t < spark.life; t += 26) {
      spark.age = t
      seen.add(particleColor(spark))
    }
    expect(seen.size).toBeGreaterThan(2)
  })

  it('fade in quickly and out at the end of life', () => {
    const blast = createPixelBlast(OPT)
    const spark = blast.particles.find(p => p.kind === 'spark')!
    spark.age = 0
    expect(particleAlpha(spark)).toBeCloseTo(0, 5)
    spark.age = 60
    expect(particleAlpha(spark)).toBeCloseTo(1, 5)
    spark.age = spark.life
    expect(particleAlpha(spark)).toBeCloseTo(0, 5)
  })

  it('stay invisible while their staggered start is pending', () => {
    const blast = createPixelBlast(OPT)
    const spark = blast.particles.find(p => p.kind === 'spark')!
    spark.age = -50
    expect(particleAlpha(spark)).toBe(0)
    expect(stepParticle(spark, 0.016)).toBe(true)
  })

  it('move further per second at a larger square size', () => {
    const small = createPixelBlast({ ...OPT, squareSize: 40 })
    const large = createPixelBlast({ ...OPT, squareSize: 100 })
    const speedOf = (b: ReturnType<typeof createPixelBlast>) => {
      const s = b.particles.find(p => p.kind === 'spark')!
      return Math.hypot(s.vx, s.vy)
    }
    expect(speedOf(large)).toBeGreaterThan(speedOf(small))
  })

  it('pull sparks down and lift smoke', () => {
    const blast = createPixelBlast(OPT)
    expect(blast.particles.find(p => p.kind === 'spark')!.gravity).toBeGreaterThan(0)
    expect(blast.particles.find(p => p.kind === 'smoke')!.gravity).toBeLessThan(0)
  })

  it('die once their life is spent', () => {
    const blast = createPixelBlast(OPT)
    const spark = blast.particles.find(p => p.kind === 'spark')!
    let alive = stepParticle(spark, 0.016)
    while (alive) alive = stepParticle(spark, 0.016)
    expect(alive).toBe(false)
  })
})

describe('frame-rate independence', () => {
  it('travel the same distance at 30 and 144 fps', () => {
    const run = (dt: number) => {
      const blast = createPixelBlast(OPT)
      const spark = blast.particles.find(p => p.kind === 'spark')!
      const startX = spark.x
      const startY = spark.y
      for (let t = 0; t < 0.4; t += dt) stepParticle(spark, dt)
      return Math.hypot(spark.x - startX, spark.y - startY)
    }
    const slow = run(1 / 30)
    const fast = run(1 / 144)
    expect(Math.abs(slow - fast) / slow).toBeLessThan(0.05)
  })
})