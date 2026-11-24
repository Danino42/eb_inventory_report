import { useRef, useState, type PointerEvent } from 'react'
import './ImageCropper.css'

/** Square frame on screen, and the size of the saved picture (twice the built-in icons) */
const FRAME = 240
const OUTPUT = 256
const MAX_ZOOM = 4

interface Props {
  /** Object URL of the chosen file */
  src: string
  /** The square picture as PNG */
  onDone: (png: Blob) => void
  onCancel: () => void
  /** The browser cannot read the file (e.g. HEIC outside Safari) */
  onUnreadable: () => void
  labels: { frame: string; zoom: string; apply: string; cancel: string }
}

interface View {
  /** Top-left corner of the picture inside the frame (≤ 0) */
  x: number
  y: number
  /** 1 = the picture just covers the frame */
  zoom: number
}

/** Small cropping tool: drag the picture into place, zoom with the slider, take the square */
export function ImageCropper({ src, onDone, onCancel, onUnreadable, labels }: Props) {
  const image = useRef<HTMLImageElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 })
  const drag = useRef<{ pointer: number; fromX: number; fromY: number; x: number; y: number } | null>(null)

  // Scale at which the picture just covers the frame
  const cover = size ? Math.max(FRAME / size.w, FRAME / size.h) : 1
  const scale = cover * view.zoom

  /** Keeps the frame filled: the picture can't be pushed out of it */
  function clamp(next: View): View {
    if (!size) return next
    const s = cover * next.zoom
    return {
      zoom: next.zoom,
      x: Math.min(0, Math.max(FRAME - size.w * s, next.x)),
      y: Math.min(0, Math.max(FRAME - size.h * s, next.y)),
    }
  }

  function loaded() {
    const img = image.current
    if (!img?.naturalWidth) return onUnreadable()
    const w = img.naturalWidth
    const h = img.naturalHeight
    const s = Math.max(FRAME / w, FRAME / h)
    setSize({ w, h })
    // Start centred
    setView({ x: (FRAME - w * s) / 2, y: (FRAME - h * s) / 2, zoom: 1 })
  }

  function zoomTo(zoom: number) {
    // Zoom around the middle of the frame
    setView((v) => {
      const ratio = zoom / v.zoom
      const middle = FRAME / 2
      return clamp({ zoom, x: middle - (middle - v.x) * ratio, y: middle - (middle - v.y) * ratio })
    })
  }

  function startDrag(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { pointer: e.pointerId, fromX: e.clientX, fromY: e.clientY, x: view.x, y: view.y }
  }

  function moveDrag(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    setView((v) => clamp({ ...v, x: d.x + e.clientX - d.fromX, y: d.y + e.clientY - d.fromY }))
  }

  function apply() {
    const img = image.current
    if (!img || !size) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return onUnreadable()
    ctx.imageSmoothingQuality = 'high'
    // The part of the original picture that is inside the frame
    ctx.drawImage(img, -view.x / scale, -view.y / scale, FRAME / scale, FRAME / scale, 0, 0, OUTPUT, OUTPUT)
    canvas.toBlob((png) => (png ? onDone(png) : onUnreadable()), 'image/png')
  }

  return (
    <div className="cropper">
      <div
        className="cropper__frame"
        style={{ width: FRAME, height: FRAME }}
        role="img"
        aria-label={labels.frame}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <img
          ref={image}
          src={src}
          alt=""
          draggable={false}
          onLoad={loaded}
          onError={onUnreadable}
          style={
            size
              ? { width: size.w * scale, height: size.h * scale, transform: `translate(${view.x}px, ${view.y}px)` }
              : { visibility: 'hidden' }
          }
        />
      </div>
      <label className="cropper__zoom">
        {labels.zoom}
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={view.zoom}
          onChange={(e) => zoomTo(Number(e.target.value))}
          disabled={!size}
        />
      </label>
      <div className="cropper__actions">
        <button type="button" className="btn" onClick={onCancel}>
          {labels.cancel}
        </button>
        <button type="button" className="btn btn--primary" onClick={apply} disabled={!size}>
          {labels.apply}
        </button>
      </div>
    </div>
  )
}
