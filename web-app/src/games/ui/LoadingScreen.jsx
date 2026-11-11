import { STAGES } from '../engine/stages.js'
import { g } from '../i18n.js'

// Écran de chargement : progression réelle de la construction du monde.
export function LoadingScreen({ stage }) {
  const ratio = Math.min(1, stage / STAGES.length)
  const label = STAGES[Math.min(stage, STAGES.length - 1)]
  return (
    <div className="game-loading" role="status" aria-live="polite">
      <div className="game-loading-inner">
        <span className="game-eyebrow">URITHI</span>
        <h1>Les Gardiens de l’Héritage</h1>
        <div className="game-loading-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label={g('chargement')}>
          <span style={{ width: `${ratio * 100}%` }} />
        </div>
        <p>
          {label} · {Math.round(ratio * 100)} %
        </p>
        <p className="game-loading-tip">{g('astuce')}</p>
      </div>
    </div>
  )
}
