// All PNGs in fruit_icons/, keyed by file name = dev name (e.g. "apple_gala").
// Adding an image named after a new fruit's dev name is enough; no code change needed.
const files = import.meta.glob<string>('./fruit_icons/*.png', { eager: true, import: 'default' })

const ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url]),
)

/** URL of the fruit's icon, or undefined if there is no image for it yet */
export function fruitIconUrl(devName: string): string | undefined {
  return ICONS[devName]
}
