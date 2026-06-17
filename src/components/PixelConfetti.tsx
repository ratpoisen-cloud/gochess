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
  swaySpeed: number
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
    let gyroPermissionRequested = false
    let currentScale = 1

    const mousePos = { x: null as number | null, y: null as number | null }
    const tilt = { x: 0, y: 0 }
    const targetTilt = { x: 0, y: 0 }

    const isMobile = window.innerWidth < 768

    const resize = () => {
      if (canvas.parentElement) {
        const rect = canvas.parentElement.getBoundingClientRect()
        currentScale = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = rect.width * currentScale
        canvas.height = rect.height * currentScale
        canvas.style.width = rect.width + 'px'
        canvas.style.height = rect.height + 'px'
        ctx.setTransform(currentScale, 0, 0, currentScale, 0, 0)
      } else {
        currentScale = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = window.innerWidth * currentScale
        canvas.height = window.innerHeight * currentScale
        canvas.style.width = window.innerWidth + 'px'
        canvas.style.height = window.innerHeight + 'px'
        ctx.setTransform(currentScale, 0, 0, currentScale, 0, 0)
      }
    }

    const createParticles = () => {
      const count = isMobile ? 150 : 350
      const newParticles: Particle[] = []

      const w = canvas.width / currentScale
      const h = canvas.height / currentScale

      const startX = isInsideBoard ? w / 2 : Math.random() * w
      const startY = isInsideBoard ? h / 2 : -20

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
          swaySpeed: Math.random() * 0.02 + 0.01,
        })
      }
      particles = newParticles
    }

    const update = () => {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Smooth tilt values
      tilt.x += (targetTilt.x - tilt.x) * 0.1
      tilt.y += (targetTilt.y - tilt.y) * 0.1

      particles.forEach((p) => {
        if (p.isFeather) {
          p.vy += 0.008
          p.vx *= 0.998
          p.vy *= 0.998
          p.vx += Math.sin(p.swayPhase) * 0.02
          p.swayPhase += p.swaySpeed
        } else {
          p.vy += 0.06
          p.vx *= 0.995
          p.vy *= 0.995
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
          const maxX = canvas.width / currentScale - padding
          const maxY = canvas.height / currentScale - padding

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
            p.vy *= -(0.3 + Math.random() * 0.2)
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
          cancelAnimationFrame(animationFrameId)
          return
        }
      } else {
        const h = canvas.height / currentScale
        const w = canvas.width / currentScale
        particles = particles.filter(p => p.y < h + 20 && p.y > -100 && p.x > -100 && p.x < w + 100)
        if (particles.length === 0) {
          cancelAnimationFrame(animationFrameId)
          return
        }
      }

      animationFrameId = requestAnimationFrame(update)
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mousePos.x = e.clientX - rect.left
      mousePos.y = e.clientY - rect.top
    }

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      const rect = canvas.getBoundingClientRect()
      mousePos.x = touch.clientX - rect.left
      mousePos.y = touch.clientY - rect.top
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 45
      const gamma = e.gamma ?? 0
      
      targetTilt.x = gamma / 90
      // Normalize beta around 45 degrees (comfortable handheld angle)
      targetTilt.y = Math.max(-1, Math.min(1, (beta - 45) / 45))
    }

    const requestGyroPermission = async () => {
      if (gyroPermissionRequested) return
      gyroPermissionRequested = true
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permission = await (DeviceOrientationEvent as any).requestPermission()
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation)
          }
        } catch (e) {
          console.warn('[Confetti] Gyro permission error:', e)
        }
      } else if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleOrientation)
      }
    }

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    requestGyroPermission()

    resize()
    createParticles()
    update()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation)
      }
      cancelAnimationFrame(animationFrameId)
    }
  }, [boardMode, lightSquareColor, darkSquareColor])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[9999]"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
