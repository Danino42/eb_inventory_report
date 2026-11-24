import { useState } from 'react'
import { builtInIconUrl, fruitIconUrl } from '../images/fruitIcons'
import './FruitIcon.css'

interface Props {
  devName: string
  /** Edge length in px */
  size?: number
  /** Shown instead of the stored picture, e.g. a freshly cropped one in the editor */
  src?: string
}

/** Small fruit picture; an empty placeholder of the same size keeps rows aligned if there is no image */
export function FruitIcon({ devName, size = 32, src }: Props) {
  const preferred = src ?? fruitIconUrl(devName)
  // An uploaded picture that cannot be loaded (e.g. offline) falls back to the built-in icon
  const [failed, setFailed] = useState<string | null>(null)
  const url = failed === preferred ? builtInIconUrl(devName) : preferred
  const style = { width: size, height: size }
  if (!url) return <span className="fruit-icon fruit-icon--empty" style={style} aria-hidden="true" />
  return (
    <img
      className="fruit-icon"
      src={url}
      style={style}
      alt=""
      decoding="async"
      onError={() => {
        if (url === preferred) setFailed(preferred)
      }}
    />
  )
}
