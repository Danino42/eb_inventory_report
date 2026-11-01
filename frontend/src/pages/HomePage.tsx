import { Link } from 'react-router'

/** Placeholder start screen until the inventory form is built */
export function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 16px' }}>
      <h1>Earlybird Warenbestände</h1>
      <p className="muted">The inventory form will live here.</p>
      <p>
        <Link to="/dev/fruits">Fruit catalogue (dev)</Link>
      </p>
    </main>
  )
}
