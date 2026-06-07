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
}

const COLORS = [
  '#7eb87e', // accent-brand (green)
  '#e8e8d8', // accent (milky white)
  '#ff4444', // danger (red)
  '#b4b4a4', // text-secondary
  '#5a8c5a', // darker green
]

interface PixelConfettiProps {
  origin?: { x: number; y: number } | null
}

export default function PixelConfetti({ origin }: PixelConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let particles: Particle[] = []

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth
        canvas.height = canvas.parentElement.clientHeight
      } else {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }
    }

    const createParticles = () => {
      const count = 150
      const newParticles: Particle[] = []
      
      const width = canvas.width
      const height = canvas.height
      
      const startX = origin ? origin.x : Math.random() * width
      const startY = origin ? origin.y : -20
      
      // Check if origin is roughly at the center
      const isAtCenter = origin && 
        Math.abs(origin.x - width / 2) < 5 && 
        Math.abs(origin.y - height / 2) < 5

      // Calculate base angle towards center of board if origin is provided and not at center
      let baseAngle = Math.PI / 2 // Default downward
      let spread = Math.PI * 2 // Default radial
      
      if (origin) {
        if (isAtCenter) {
          spread = Math.PI * 2
        } else {
          baseAngle = Math.atan2(height / 2 - origin.y, width / 2 - origin.x)
          spread = Math.PI / 3 // 60-degree cone
        }
      }
      
      for (let i = 0; i < count; i++) {
        const angle = origin && !isAtCenter 
          ? baseAngle + (Math.random() - 0.5) * spread
          : Math.random() * Math.PI * 2
        
        const force = origin ? Math.random() * 10 + 5 : Math.random() * 4 + 2
        
        newParticles.push({
          x: startX,
          y: startY,
          size: Math.floor(Math.random() * 2 + 1) * 4,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          vx: Math.cos(angle) * force,
          vy: Math.sin(angle) * force - (origin ? 3 : 0), // Upward bias for explosions
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.2
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
        // Physics
        p.vy += 0.18 // Gravity
        p.vx *= 0.97 // Air resistance
        p.vy *= 0.97 // Air resistance
        
        p.y += p.vy
        p.x += p.vx
        
        p.rotation += p.rotationSpeed

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        ctx.restore()
      })

      particles = particles.filter(p => p.y < canvas.height + 20 && p.y > -100 && p.x > -100 && p.x < canvas.width + 100)

      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(update)
      }
    }

    window.addEventListener('resize', resize)
    resize()
    createParticles()
    update()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [origin])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[100] overflow-hidden"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
