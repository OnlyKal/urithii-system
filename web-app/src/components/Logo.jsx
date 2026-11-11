import { Link } from 'react-router'

import { t } from '../i18n/index.js'
// Marque URITHI : logo officiel (public/brand). Version bleue sur fond clair ;
// `inverse` : version blanche, pour l'en-tête, le menu et le pied de page bleus.
export function Logo({ to = '/', inverse = false }) {
  return (
    <Link to={to} className={`brand ${inverse ? 'brand-inverse' : ''}`} aria-label={t('logo.urithiAccueil')}>
      <img className="brand-mark" src={inverse ? '/brand/mark-blanc-64.png' : '/brand/mark-bleu-64.png'} alt="" width="30" height="30" />
      URITHI
    </Link>
  )
}
