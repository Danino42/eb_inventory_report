import { useEffect, useRef, useState, type FormEvent } from 'react'

interface Props {
  names: string[]
  current: string
  onPick: (name: string) => void
  onClose: () => void
}

/** Big name buttons, plus a text field for anyone not on the list */
export function NamePicker({ names, current, onPick, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [other, setOther] = useState(names.includes(current) ? '' : current)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function submitOther(e: FormEvent) {
    e.preventDefault()
    const name = other.trim()
    if (name) onPick(name)
  }

  return (
    <dialog ref={dialogRef} className="sheet" onClose={onClose}>
      <div className="sheet__body">
        <header className="sheet__header">
          <h2>Wer füllt aus?</h2>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
        </header>
        <div className="name-grid">
          {names.map((name) => (
            <button
              key={name}
              type="button"
              className={`name-grid__button${name === current ? ' is-active' : ''}`}
              onClick={() => onPick(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <form className="name-other" onSubmit={submitOther}>
          <label>
            Anderer Name
            <input value={other} onChange={(e) => setOther(e.target.value)} autoComplete="off" />
          </label>
          <button type="submit" className="btn btn--primary" disabled={!other.trim()}>
            Übernehmen
          </button>
        </form>
      </div>
    </dialog>
  )
}
