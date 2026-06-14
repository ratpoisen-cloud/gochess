import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'

export type VFXType = 'ice-shatter' | 'blast' | 'jump' | 'portal' | 'confetti'

interface VFXConfig {
  x: number
  y: number
  type: VFXType
  color?: string
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
  confetti: ['#f0f0f0', '#ff4444', '#121416', '#accent-brand']
}

export const MagicVFX = forwardRef<MagicVFXHandle, { boardWidth: number }>(({}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const requestRef = useRef<number>()

  const spawnParticles = (config: VFXConfig) => {
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
            friction: 0.94,
          })
        }
        break
      case 'jump':
        count = 30
        typeColors = COLORS.jump
        for (let i = 0; i < count; i++) {
          const angle = (Math.random() * Math.PI) + Math.PI // Upward fountain
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
            vx: (config.x - px) * 0.1, // Fly towards center
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
    }

    particlesRef.current = [...particlesRef.current, ...newParticles]
    
    if (!requestRef.current) {
      requestRef.current = requestAnimationFrame(update)
    }
  }

  const update = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const nextParticles: Particle[] = []

    particlesRef.current.forEach(p => {
      p.vy += p.gravity
      p.vx *= p.friction
      p.vy *= p.friction

      if (p.isFeather) {
        p.vx += Math.sin(p.swayPhase!) * 0.1
        p.swayPhase! += p.swaySpeed!
      }

      p.x += p.vx
      p.y += p.vy
      p.rotation += p.rotationSpeed
      p.alpha -= p.decay
      if (p.shrink) p.size *= p.shrink

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

    if (nextParticles.length > 0) {
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
    
    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect()
      const scale = window.devicePixelRatio || 1
      canvas.width = rect.width * scale
      canvas.height = rect.height * scale
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      canvas.getContext('2d')?.scale(scale, scale)
    }

    window.addEventListener('resize', resize)
    resize()
    return () => window.removeEventListener('resize', resize)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[10000]"
      style={{ imageRendering: 'pixelated' }}
    />
  )
})
