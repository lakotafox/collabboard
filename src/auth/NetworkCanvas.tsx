import { useEffect, useRef } from 'react'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  pulse: number
  pulseSpeed: number
}

interface Signal {
  fromIdx: number
  toIdx: number
  progress: number
  speed: number
}

export function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let nodes: Node[] = []
    let signals: Signal[] = []
    let time = 0

    const CONNECTION_DIST = 160
    const NODE_COUNT = 60
    const MAX_SIGNALS = 20

    // Accent color: blue theme matching the app
    const R = 137, G = 180, B = 250 // #89b4fa

    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas!.width = canvas!.offsetWidth * dpr
      canvas!.height = canvas!.offsetHeight * dpr
      ctx!.scale(dpr, dpr)
    }

    function init() {
      resize()
      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight

      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.8,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.03 + 0.008,
      }))
    }

    function spawnSignal() {
      if (signals.length >= MAX_SIGNALS) return
      const i = Math.floor(Math.random() * nodes.length)
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < CONNECTION_DIST) {
          signals.push({
            fromIdx: i,
            toIdx: j,
            progress: 0,
            speed: 0.008 + Math.random() * 0.015,
          })
          return
        }
      }
    }

    function draw() {
      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight
      time++

      ctx!.clearRect(0, 0, w, h)

      // Update positions
      for (const node of nodes) {
        node.x += node.vx
        node.y += node.vy
        node.pulse += node.pulseSpeed
        if (node.x < -10) node.x = w + 10
        if (node.x > w + 10) node.x = -10
        if (node.y < -10) node.y = h + 10
        if (node.y > h + 10) node.y = -10
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.08
            ctx!.beginPath()
            ctx!.moveTo(nodes[i].x, nodes[i].y)
            ctx!.lineTo(nodes[j].x, nodes[j].y)
            ctx!.strokeStyle = `rgba(${R}, ${G}, ${B}, ${alpha})`
            ctx!.lineWidth = 0.5
            ctx!.stroke()
          }
        }
      }

      // Spawn signals
      if (time % 8 === 0) spawnSignal()

      // Draw signals
      signals = signals.filter((sig) => {
        sig.progress += sig.speed
        if (sig.progress >= 1) return false

        const from = nodes[sig.fromIdx]
        const to = nodes[sig.toIdx]
        if (!from || !to) return false

        const dx = to.x - from.x
        const dy = to.y - from.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > CONNECTION_DIST * 1.2) return false

        const px = from.x + dx * sig.progress
        const py = from.y + dy * sig.progress

        const edgeFade = Math.sin(sig.progress * Math.PI)
        const flicker = 0.6 + Math.sin(time * 0.3 + sig.progress * 20) * 0.4
        const alpha = edgeFade * flicker * 0.9

        // Glowing connection
        const grad = ctx!.createLinearGradient(from.x, from.y, to.x, to.y)
        const sigPos = sig.progress
        const spread = 0.08
        grad.addColorStop(Math.max(0, sigPos - spread * 2), `rgba(${R}, ${G}, ${B}, 0)`)
        grad.addColorStop(Math.max(0, sigPos - spread), `rgba(${R}, ${G}, ${B}, ${alpha * 0.3})`)
        grad.addColorStop(sigPos, `rgba(${R}, ${G}, ${B}, ${alpha})`)
        grad.addColorStop(Math.min(1, sigPos + spread), `rgba(${R}, ${G}, ${B}, ${alpha * 0.3})`)
        grad.addColorStop(Math.min(1, sigPos + spread * 2), `rgba(${R}, ${G}, ${B}, 0)`)

        ctx!.beginPath()
        ctx!.moveTo(from.x, from.y)
        ctx!.lineTo(to.x, to.y)
        ctx!.strokeStyle = grad
        ctx!.lineWidth = 1.5
        ctx!.stroke()

        // Signal dot
        ctx!.beginPath()
        ctx!.arc(px, py, 2 + edgeFade * 1.5, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${R}, ${G}, ${B}, ${alpha})`
        ctx!.fill()

        // Glow
        ctx!.beginPath()
        ctx!.arc(px, py, 6 + edgeFade * 4, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${R}, ${G}, ${B}, ${alpha * 0.15})`
        ctx!.fill()

        // Destination burst
        if (sig.progress > 0.85) {
          const burstAlpha = (sig.progress - 0.85) / 0.15 * 0.4
          ctx!.beginPath()
          ctx!.arc(to.x, to.y, 8, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(${R}, ${G}, ${B}, ${burstAlpha})`
          ctx!.fill()
        }

        return true
      })

      // Draw nodes
      for (const node of nodes) {
        const glow = (Math.sin(node.pulse) + 1) / 2
        const alpha = 0.25 + glow * 0.35

        ctx!.beginPath()
        ctx!.arc(node.x, node.y, node.r + 4, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${R}, ${G}, ${B}, ${alpha * 0.08})`
        ctx!.fill()

        ctx!.beginPath()
        ctx!.arc(node.x, node.y, node.r + glow * 0.5, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${R}, ${G}, ${B}, ${alpha})`
        ctx!.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    init()
    draw()

    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.7,
      }}
    />
  )
}
