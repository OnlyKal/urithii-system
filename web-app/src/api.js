import fr from './i18n/locales/fr.js'
import { t } from './i18n/index.js'

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error || t('common.unexpectedError'), data.details)
  return data
}

// Les messages du serveur sont rédigés en français : on les traduit lorsqu'ils
// figurent dans le dictionnaire (clés « server.* »). Pour un message composé
// « préfixe : détail », seul le détail connu est traduit.
const SERVER_ENTRIES = Object.entries(fr).filter(([key]) => key.startsWith('server.'))
const SERVER_KEYS = new Map(SERVER_ENTRIES.filter(([, text]) => !text.includes('{')).map(([key, text]) => [text, key]))

// Messages à partie variable (« Lieu inconnu : « {0} » »…) : reconnus par
// motif, la partie variable étant reprise telle quelle.
const escape = (text) => text.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
const SERVER_PATTERNS = SERVER_ENTRIES.filter(([, text]) => text.includes('{')).map(([key, text]) => ({
  key,
  regex: new RegExp(`^${escape(text).replace(/\\?\{(\d)\\?\}/g, '(.+?)')}$`),
}))

export function translateServerMessage(message) {
  if (!message) return message
  if (SERVER_KEYS.has(message)) return t(SERVER_KEYS.get(message))
  for (const { key, regex } of SERVER_PATTERNS) {
    const match = message.match(regex)
    if (match) return t(key, Object.fromEntries(match.slice(1).map((v, i) => [i, v])))
  }
  const at = message.lastIndexOf(' : ')
  if (at > 0) {
    const detail = message.slice(at + 3)
    if (SERVER_KEYS.has(detail)) return `${message.slice(0, at)} : ${t(SERVER_KEYS.get(detail))}`
  }
  return message
}

// Envoi multipart (téléversement de fichiers).
export async function upload(path, formData) {
  let res
  try {
    res = await fetch(`/api${path}`, { method: 'POST', credentials: 'same-origin', body: formData })
  } catch {
    // Connexion coupée pendant l'envoi (réseau instable, fichier très lourd).
    throw new ApiError(0, t('upload.connexionInterrompue'))
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Réponse sans message de l'API : refus du serveur web en amont.
    const fallback =
      res.status === 413
        ? t('upload.tropVolumineux')
        : [408, 502, 503, 504].includes(res.status)
          ? t('upload.delaiDepasse')
          : `${t('common.unexpectedError')} (${t('upload.code', { code: res.status })})`
    throw new ApiError(res.status, data.error || fallback, data.details)
  }
  return data
}

export function errorText(err) {
  if (!err) return null
  const message = translateServerMessage(err.message)
  if (err.details?.length) return `${message} : ${err.details.map((d) => translateServerMessage(d.message)).join(' ; ')}`
  return message
}
