'use client'

import { useEffect, useRef, useState } from 'react'
import { Eraser, PenLine } from 'lucide-react'

/**
 * Lightweight canvas signature pad. Captures mouse, finger and stylus input via
 * Pointer Events, then reports a transparent-background PNG data URL up to the
 * parent whenever the stroke ends. Calling clear resets both the canvas and the
 * reported value.
 */
export function SignaturePad({
  onChange,
  className = '',
}: {
  onChange: (dataUrl: string) => void
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [empty, setEmpty] = useState(true)

  // Size the canvas to its container for crisp lines on hi-dpi screens.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      const c = canvasRef.current
      if (!c) return
      const rect = c.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      c.width = Math.round(rect.width * dpr)
      c.height = Math.round(rect.height * dpr)
      const context = c.getContext('2d')
      if (!context) return
      context.scale(dpr, dpr)
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.lineWidth = 2.4
      context.strokeStyle = '#f4f7fb'
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    drawing.current = true
    last.current = pointFromEvent(e)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !last.current) return
    const p = pointFromEvent(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    hasInk.current = true
    if (empty) setEmpty(false)
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    if (hasInk.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'))
    }
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasInk.current = false
    setEmpty(true)
    onChange('')
  }

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-xl border border-steel bg-background">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          className="h-44 w-full touch-none cursor-crosshair"
          aria-label="Signature pad — sign with your mouse, finger or stylus"
        />
        {empty ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-light-grey">
            <PenLine className="size-6" />
            <span className="text-xs font-semibold uppercase tracking-wide">Sign here</span>
          </div>
        ) : null}
        {/* signature baseline */}
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-steel/70" />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-light-grey">Use your mouse, finger or stylus to sign.</p>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1.5 rounded-md border border-steel px-3 py-1.5 text-xs font-semibold text-light-grey transition-colors hover:border-neon-blue hover:text-neon-blue"
        >
          <Eraser className="size-3.5" /> Clear
        </button>
      </div>
    </div>
  )
}
