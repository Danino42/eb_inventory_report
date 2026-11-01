import { fruitIconUrl } from '../images/fruitIcons'
import './FruitIcon.css'

interface Props {
  devName: string
  /** Edge length in px */
  size?: number
}

/** Small fruit picture; an empty placeholder of the same size keeps rows aligned if there is no image */
export function FruitIcon({ devName, size = 32 }: Props) {
  const url = fruitIconUrl(devName)
  const style = { width: size, height: size }
  if (!url) return <span className="fruit-icon fruit-icon--empty" style={style} aria-hidden="true" />
  return <img className="fruit-icon" src={url} style={style} alt="" loading="lazy" decoding="async" />
}
