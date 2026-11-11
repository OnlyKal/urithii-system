// Affiche un texte saisi par les contributeurs : paragraphes séparés par une
// ligne vide, intertitres commençant par « ## », listes dont chaque ligne
// commence par « - ». Aucun HTML n'est interprété.
const isList = (block) => block.split('\n').every((line) => line.trim().startsWith('- '))

export default function Prose({ text }) {
  if (!text) return null
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  return (
    <div className="prose">
      {blocks.map((block, i) =>
        block.startsWith('## ') ? (
          <h3 key={i}>{block.slice(3)}</h3>
        ) : isList(block) ? (
          <ul key={i}>
            {block.split('\n').map((line, j) => (
              <li key={j}>{line.trim().slice(2)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {block.split('\n').map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  )
}
