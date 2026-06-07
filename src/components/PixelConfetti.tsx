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

export default function PixelConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let particles: Particle[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const createParticles = () => {
      const count = 150
      const newParticles: Particle[] = []
      
      for (let i = 0; i < count; i++) {
        newParticles.push({
          x: Math.random() * canvas.width,
          y: -20 - Math.random() * 100, // Start slightly above screen
          size: Math.floor(Math.random() * 3 + 2) * 4, // 8, 12, 16px (pixelated sizes)
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 5 + 2,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.1
        })
      }
      particles = newParticles
    }

    const update = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p) => {
        p.y += p.vy
        p.x += p.vx
        p.vx += Math.sin(Date.now() / 1000 + p.x) * 0.05 // Subtle wind
        p.rotation += p.rotationSpeed

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        // Drawing a square for pixel effect
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        ctx.restore()
      })

      // Clean up particles that left the screen
      particles = particles.filter(p => p.y < canvas.height + 20)

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
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
