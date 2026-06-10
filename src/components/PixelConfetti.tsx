import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  size: number
  color: string
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  isFeather?: boolean
  swayPhase: number
}

const BASE_COLORS = [
  '#f0f0f0',
  '#ff4444',
]

interface PixelConfettiProps {
  boardMode?: boolean
  lightSquareColor?: string
  darkSquareColor?: string
}

export default function PixelConfetti({ boardMode, lightSquareColor, darkSquareColor }: PixelConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isInsideBoard = Boolean(boardMode)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const COLORS = [
      ...BASE_COLORS,
      ...(lightSquareColor ? [lightSquareColor] : []),
      ...(darkSquareColor ? [darkSquareColor] : []),
    ]

    let animationFrameId: number
    let particles: Particle[] = []

    const mousePos = { x: null as number | null, y: null as number | null }
    const tilt = { x: 0, y: 0 }

    const resize = () => {
      if (canvas.parentElement) {
        const rect = canvas.parentElement.getBoundingClientRect()
        canvas.width = rect.width
        canvas.height = rect.height
      } else {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }
    }

    const createParticles = () => {
      const count = 350
      const newParticles: Particle[] = []

      const width = canvas.width
      const height = canvas.height

      const startX = isInsideBoard ? width / 2 : Math.random() * width
      const startY = isInsideBoard ? height / 2 : -20

      for (let i = 0; i < count; i++) {
        const isFeather = isInsideBoard && Math.random() < 0.2
        const angle = Math.random() * Math.PI * 2
        const baseForce = isInsideBoard ? Math.random() * 10 + 5 : Math.random() * 4 + 2
        const fFactor = isFeather ? 0.4 + Math.random() * 0.3 : 1

        newParticles.push({
          x: startX,
          y: startY,
          size: Math.floor(Math.random() * 2 + 1) * 4,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          vx: Math.cos(angle) * baseForce * fFactor,
          vy: Math.sin(angle) * baseForce * fFactor - (isInsideBoard ? 3 : 0) - (isFeather ? 2 : 0),
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.2,
          isFeather,
          swayPhase: Math.random() * Math.PI * 2,
        })
      }
      particles = newParticles
    }

    const update = () => {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p) => {
        if (p.isFeather) {
          p.vy += 0.008
          p.vx *= 0.998
          p.vy *= 0.998
          p.vx += Math.sin(p.swayPhase) * 0.02
          p.swayPhase += 0.015
        } else {
          p.vy += 0.06
          p.vx *= 0.992
          p.vy *= 0.992
        }

        if (mousePos.x !== null && mousePos.y !== null) {
          const dx = p.x - mousePos.x
          const dy = p.y - mousePos.y
          const dist = Math.hypot(dx, dy)
          if (dist < 120 && dist > 1) {
            const force = 30 / dist
            const mult = p.isFeather ? 2 : 1
            p.vx += (dx / dist) * force * mult
            p.vy += (dy / dist) * force * mult
          }
        }

        if (tilt.x !== 0 || tilt.y !== 0) {
          const mult = p.isFeather ? 3 : 1
          p.vx += tilt.x * 0.015 * mult
          p.vy += tilt.y * 0.015 * mult
        }

        p.x += p.vx
        p.y += p.vy

        p.rotation += p.rotationSpeed

        if (isInsideBoard) {
          const padding = p.size
          const maxX = canvas.width - padding
          const maxY = canvas.height - padding

          if (p.x < padding) {
            p.x = padding
            p.vx *= -0.5
          }
          if (p.x > maxX) {
            p.x = maxX
            p.vx *= -0.5
          }
          if (p.y < padding) {
            p.y = padding
            p.vy *= -0.5
          }
          if (p.y > maxY) {
            p.y = maxY
            p.vy *= -0.3
            p.vx *= 0.95
          }

          const threshold = p.isFeather ? 0.03 : 0.15
          if (Math.abs(p.vy) < threshold && Math.abs(p.vx) < threshold && p.y >= maxY - 1) {
            p.vy = 0
            p.vx = 0
            p.y = maxY
          }
        }

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        ctx.restore()
      })

      if (isInsideBoard) {
        if (!particles.some(p => p.vy !== 0 || p.vx !== 0)) {
          return
        }
      } else {
        particles = particles.filter(p => p.y < canvas.height + 20 && p.y > -100 && p.x > -100 && p.x < canvas.width + 100)
        if (particles.length === 0) return
      }

      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(update)
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mousePos.x = e.clientX - rect.left
      mousePos.y = e.clientY - rect.top
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      tilt.x = (e.gamma ?? 0) / 90
      tilt.y = ((e.beta ?? 90) - 90) / 90
    }

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('deviceorientation', handleOrientation)

    resize()
    createParticles()
    update()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('deviceorientation', handleOrientation)
      cancelAnimationFrame(animationFrameId)
    }
  }, [boardMode, darkSquareColor])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[9999]"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
