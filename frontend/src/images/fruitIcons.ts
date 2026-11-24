// All PNGs in fruit_icons/, keyed by file name = dev name (e.g. "apple_gala").
// Adding an image named after a new fruit's dev name is enough; no code change needed.
const files = import.meta.glob<string>('./fruit_icons/*.png', { eager: true, import: 'default' })

const ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url]),
)

// Pictures uploaded in the Verwaltung, learnt from the fruit list (see rememberUploadedIcons)
const uploaded = new Map<string, string>()

/** Notes the uploaded pictures of these fruits; they win over the built-in icons */
export function rememberUploadedIcons(
  fruits: { dev_name: string; image_version?: string | null }[],
  urlFor: (devName: string, version: string) => string,
): void {
  for (const f of fruits) {
    if (f.image_version) uploaded.set(f.dev_name, urlFor(f.dev_name, f.image_version))
    else uploaded.delete(f.dev_name)
  }
}

/** The built-in icon only (fallback if an uploaded picture cannot be loaded, e.g. offline) */
export function builtInIconUrl(devName: string): string | undefined {
  return ICONS[devName]
}

/** URL of the fruit's picture (uploaded or built-in), or undefined if there is none yet */
export function fruitIconUrl(devName: string): string | undefined {
  return uploaded.get(devName) ?? ICONS[devName]
}
