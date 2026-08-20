import Link from 'next/link'
import BrandMark from './BrandMark'

type AppNavProps = {
  active: 'discover' | 'matches' | 'profile'
}

export default function AppNav({ active }: AppNavProps) {
  return (
    <div className="app-nav">
      <BrandMark />
      <div className="app-nav-links">
        <Link href="/discover" className={`nav-link ${active === 'discover' ? 'active' : ''}`}>
          Découvrir
        </Link>
        <Link href="/matches" className={`nav-link ${active === 'matches' ? 'active' : ''}`}>
          Matchs
        </Link>
        <Link href="/profile/edit" className={`nav-link ${active === 'profile' ? 'active' : ''}`}>
          Mon profil
        </Link>
      </div>
      <div className="avatar-circle" aria-hidden="true">
        {' '}
      </div>
    </div>
  )
}
