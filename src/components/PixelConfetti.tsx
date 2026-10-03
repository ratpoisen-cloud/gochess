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
  age: number
  life: number
}

// Случайная жизнь каждой частицы: она гаснет поштучно, а не кучкой.
// FADE_MS — сколько гаснет последняя частица; HARD_LIMIT_MS — жёсткий
// предел, после которого canvas очищается в любом случае.
const LIFE_MIN_MS = 1200
const LIFE_MAX_MS = 2500
const FADE_MS = 400
const HARD_LIMIT_MS = 8000
// Скорость не должна взлетать от репульсии/отскоков — иначе конфетти
// «чертят» следы и сминаются в неразбериху.
const MAX_SPEED = 18
// Дно: честный затухающий отскок без «подарка» скорости (старый
// vy = -(0.3+rand*0.2) разгонял лежащие частицы — они вечно дрожали).
const BOUNCE_DAMP = 0.35

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
    let elapsed = 0
    let lastFrameAt = performance.now()

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
          age: 0,
          life: LIFE_MIN_MS + Math.random() * (LIFE_MAX_MS - LIFE_MIN_MS),
        })
      }
      particles = newParticles
    }

    const update = (now?: number) => {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const frameAt = now ?? performance.now()
      const deltaMs = Math.min(frameAt - lastFrameAt, 100)
      lastFrameAt = frameAt

      // Очистка строго в identity-трансформе: любой рассинхрон scale/rotate
      // иначе оставляет нетронутые полосы — «следы от движения».
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()

      elapsed += deltaMs

      // Smooth tilt values
      tilt.x += (targetTilt.x - tilt.x) * 0.1
      tilt.y += (targetTilt.y - tilt.y) * 0.1

      particles.forEach((p) => {
        p.age += deltaMs
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

        if (!isInsideBoard && mousePos.x !== null && mousePos.y !== null) {
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

        // Clamp: репульсия и отскоки не должны разгонять частицы
        // до скоростей, оставляющих визуальные «размазы».
        const speed = Math.hypot(p.vx, p.vy)
        if (speed > MAX_SPEED) {
          p.vx = (p.vx / speed) * MAX_SPEED
          p.vy = (p.vy / speed) * MAX_SPEED
        }

        p.x += p.vx
        p.y += p.vy

        p.rotation += p.rotationSpeed

        if (isInsideBoard) {
          // Только дно: частицы, долетевшие до краёв, просто уходят за
          // край и обрезаются overflow-hidden контейнером. Старые боковые
          // стенки направляли их вдоль кромки — там и копились ленты.
          const maxY = canvas.height / currentScale
          if (p.y > maxY) {
            p.y = maxY
            p.vy = -Math.abs(p.vy) * BOUNCE_DAMP
            p.vx *= 0.95
          }
        }

        // Гаснет поштучно: у каждой частицы свой срок, общий fade не нужен.
        const fadeIn = Math.min(1, p.age / 150)
        const fadeOut = Math.max(0, 1 - Math.max(0, p.age - (p.life - FADE_MS)) / FADE_MS)
        ctx.globalAlpha = fadeIn * fadeOut

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        ctx.restore()
      })

      ctx.globalAlpha = 1

      particles = particles.filter(p => p.age < p.life)

      const done = elapsed > HARD_LIMIT_MS || particles.length === 0
      if (done) {
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.restore()
        cancelAnimationFrame(animationFrameId)
        return
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
    lastFrameAt = performance.now()
    animationFrameId = requestAnimationFrame(update)

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
