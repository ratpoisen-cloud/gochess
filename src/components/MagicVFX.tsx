import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import {
  createPixelBlast,
  ringDots,
  ringColor,
  particleColor,
  particleAlpha,
  stepParticle,
  stepRing,
} from '@/lib/pixelBlast'
import type { PixelBlast } from '@/lib/pixelBlast'

export type VFXType =
  | 'ice-shatter'
  | 'blast'
  | 'jump'
  | 'portal'
  | 'confetti'
  | 'sparkle'
  | 'shield'
  | 'atomic-blast'

interface VFXConfig {
  x: number
  y: number
  type: VFXType
  color?: string
  squareSize?: number
}

export interface MagicVFXHandle {
  trigger: (config: VFXConfig) => void
}

interface Particle {
  x: number
  y: number
  size: number
  color: string
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  alpha: number
  decay: number
  gravity: number
  friction: number
  isFeather?: boolean
  swayPhase?: number
  swaySpeed?: number
  shrink?: number
}

const COLORS = {
  ice: ['#ffffff', '#aaddff', '#77ccff', '#bbecff'],
  blast: ['#ff4444', '#ff8800', '#ffcc00', '#444444'],
  jump: ['#44ff44', '#aaffaa', '#00ff88'],
  portal: ['#a020f0', '#ff00ff', '#5500aa', '#000000'],
  confetti: ['#f0f0f0', '#ff4444', '#121416', '#accent-brand'],
  sparkle: ['#ffd700', '#ffec8b', '#fff8dc', '#daa520'],
  shield: ['#ffd700', '#ffaa00', '#ffcc44', '#ffee88']
}

const FALLBACK_SQUARE_SIZE = 60
const MAX_FRAME_MS = 100
const PIXEL_RATIO_CAP = 2

export const MagicVFX = forwardRef<MagicVFXHandle, { boardWidth: number }>(({ boardWidth }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const blastsRef = useRef<PixelBlast[]>([])
  const requestRef = useRef<number>()
  const lastFrameAtRef = useRef<number>(0)
  const boardWidthRef = useRef(boardWidth)

  const ensureRunning = () => {
    if (requestRef.current) return
    lastFrameAtRef.current = performance.now()
    requestRef.current = requestAnimationFrame(update)
  }

  const spawnBlast = (config: VFXConfig) => {
    const blast = createPixelBlast({
      x: config.x,
      y: config.y,
      squareSize: config.squareSize || boardWidthRef.current / 8 || FALLBACK_SQUARE_SIZE
    })
    blastsRef.current = [...blastsRef.current, blast]
    ensureRunning()
  }

  const spawnParticles = (config: VFXConfig) => {
    if (config.type === 'atomic-blast') {
      spawnBlast(config)
      return
    }

    const newParticles: Particle[] = []
    let count = 20
    let typeColors = COLORS.ice

    switch (config.type) {
      case 'ice-shatter':
        count = 40
        typeColors = COLORS.ice
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2
          const force = Math.random() * 6 + 2
          newParticles.push({
            x: config.x,
            y: config.y,
            size: Math.random() * 4 + 2,
            color: typeColors[Math.floor(Math.random() * typeColors.length)],
            vx: Math.cos(angle) * force,
            vy: Math.sin(angle) * force - 2,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.3,
            alpha: 1,
            decay: 0.02 + Math.random() * 0.02,
            gravity: 0.15,
            friction: 0.98,
            shrink: 0.96
          })
        }
        break
      case 'blast':
        count = 60
        typeColors = COLORS.blast
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2
          const force = Math.random() * 12 + 4
          const isSmoke = Math.random() > 0.6
          newParticles.push({
            x: config.x,
            y: config.y,
            size: isSmoke ? Math.random() * 8 + 4 : Math.random() * 4 + 2,
            color: isSmoke ? '#444444' : typeColors[Math.floor(Math.random() * typeColors.length)],
            vx: Math.cos(angle) * force,
            vy: Math.sin(angle) * force,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2,
            alpha: 1,
            decay: isSmoke ? 0.01 : 0.03,
            gravity: isSmoke ? -0.05 : 0.1,
            friction: 0.94
          })
        }
        break
      case 'jump':
        count = 30
        typeColors = COLORS.jump
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI + Math.PI
          const force = Math.random() * 4 + 1
          newParticles.push({
            x: config.x,
            y: config.y,
            size: Math.random() * 3 + 1,
            color: typeColors[Math.floor(Math.random() * typeColors.length)],
            vx: Math.cos(angle) * force,
            vy: Math.sin(angle) * force,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.1,
            alpha: 1,
            decay: 0.015,
            gravity: 0.05,
            friction: 0.99,
            isFeather: true,
            swayPhase: Math.random() * Math.PI * 2,
            swaySpeed: Math.random() * 0.05 + 0.02
          })
        }
        break
      case 'portal':
        count = 40
        typeColors = COLORS.portal
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2
          const radius = 40
          const px = config.x + Math.cos(angle) * radius
          const py = config.y + Math.sin(angle) * radius
          newParticles.push({
            x: px,
            y: py,
            size: Math.random() * 5 + 2,
            color: typeColors[Math.floor(Math.random() * typeColors.length)],
            vx: (config.x - px) * 0.1,
            vy: (config.y - py) * 0.1,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: 0.2,
            alpha: 1,
            decay: 0.02,
            gravity: 0,
            friction: 1,
            shrink: 0.9
          })
        }
        break
      case 'shield':
        count = 30
        typeColors = COLORS.shield
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2
          const force = Math.random() * 4 + 2
          newParticles.push({
            x: config.x,
            y: config.y,
            size: Math.random() * 4 + 2,
            color: typeColors[Math.floor(Math.random() * typeColors.length)],
            vx: Math.cos(angle) * force,
            vy: Math.sin(angle) * force - 1,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2,
            alpha: 1,
            decay: 0.02,
            gravity: 0.05,
            friction: 0.97,
            shrink: 0.96
          })
        }
        break
      case 'sparkle':
        count = 25
        typeColors = COLORS.sparkle
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2
          const force = Math.random() * 8 + 3
          newParticles.push({
            x: config.x,
            y: config.y,
            size: Math.random() * 5 + 2,
            color: typeColors[Math.floor(Math.random() * typeColors.length)],
            vx: Math.cos(angle) * force,
            vy: Math.sin(angle) * force - 3,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.4,
            alpha: 1,
            decay: 0.04,
            gravity: 0.08,
            friction: 0.95,
            shrink: 0.94
          })
        }
        break
    }

    particlesRef.current = [...particlesRef.current, ...newParticles]
    ensureRunning()
  }

  const drawPixel = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size)
  }

  const renderBlasts = (ctx: CanvasRenderingContext2D, dtSeconds: number) => {
    const alive: PixelBlast[] = []

    for (const blast of blastsRef.current) {
      const nextRings = blast.rings.filter(ring => stepRing(ring, dtSeconds))

      for (const ring of nextRings) {
        ctx.globalAlpha = 1
        ctx.fillStyle = ringColor(ring)
        for (const dot of ringDots(ring)) {
          drawPixel(ctx, dot.x, dot.y, ring.thickness)
        }
      }

      const live = blast.particles.filter(p => stepParticle(p, dtSeconds))

      for (const p of live) {
        const alpha = particleAlpha(p)
        if (alpha <= 0) continue
        ctx.globalAlpha = alpha
        ctx.fillStyle = particleColor(p)
        if (p.spin !== 0) {
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.spin)
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
          ctx.restore()
        } else {
          drawPixel(ctx, p.x, p.y, p.size)
        }
      }

      if (live.length > 0 || nextRings.length > 0) {
        blast.particles = live
        blast.rings = nextRings
        alive.push(blast)
      }
    }

    ctx.globalAlpha = 1
    blastsRef.current = alive
  }

  function update(frameAt?: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const now = frameAt ?? performance.now()
    const elapsed = now - lastFrameAtRef.current
    const deltaMs = elapsed < 0 ? 0 : Math.min(elapsed, MAX_FRAME_MS)
    lastFrameAtRef.current = now
    const dtSeconds = deltaMs / 1000

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()

    const frames = dtSeconds * 60
    const nextParticles: Particle[] = []

    particlesRef.current.forEach(p => {
      p.vy += p.gravity * frames
      p.vx *= Math.pow(p.friction, frames)
      p.vy *= Math.pow(p.friction, frames)

      if (p.isFeather) {
        p.vx += Math.sin(p.swayPhase!) * 0.1 * frames
        p.swayPhase! += p.swaySpeed! * frames
      }

      p.x += p.vx * frames
      p.y += p.vy * frames
      p.rotation += p.rotationSpeed * frames
      p.alpha -= p.decay * frames
      if (p.shrink) p.size *= Math.pow(p.shrink, frames)

      if (p.alpha > 0 && p.size > 0.1) {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        ctx.restore()
        nextParticles.push(p)
      }
    })

    particlesRef.current = nextParticles
    ctx.globalAlpha = 1

    renderBlasts(ctx, dtSeconds)

    if (particlesRef.current.length > 0 || blastsRef.current.length > 0) {
      requestRef.current = requestAnimationFrame(update)
    } else {
      requestRef.current = undefined
    }
  }

  useImperativeHandle(ref, () => ({
    trigger: spawnParticles
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !canvas.parentElement) return
    const parent = canvas.parentElement
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const rect = parent.getBoundingClientRect()
      const scale = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP)
      canvas.width = Math.round(rect.width * scale)
      canvas.height = Math.round(rect.height * scale)
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
    }

    window.addEventListener('resize', resize)
    resize()
    return () => {
      window.removeEventListener('resize', resize)
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
      particlesRef.current = []
      blastsRef.current = []
    }
  }, [])

  useEffect(() => {
    boardWidthRef.current = boardWidth
    const canvas = canvasRef.current
    if (!canvas || !canvas.parentElement) return
    const rect = canvas.parentElement.getBoundingClientRect()
    const scale = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP)
    canvas.width = Math.round(rect.width * scale)
    canvas.height = Math.round(rect.height * scale)
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'
    canvas.getContext('2d')?.setTransform(scale, 0, 0, scale, 0, 0)
  }, [boardWidth])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[10000]"
      style={{ imageRendering: 'pixelated' }}
    />
  )
})