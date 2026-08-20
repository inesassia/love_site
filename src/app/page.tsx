import Link from 'next/link'
import BrandMark from '@/components/BrandMark'

const FEATURES = [
  {
    title: 'Des profils enracinés dans la foi',
    description:
      'Dénomination, fréquentation d’église, vision du mariage, un verset ou une valeur qui vous tient à cœur : chaque profil dit qui vous êtes, pas seulement à quoi vous ressemblez.',
  },
  {
    title: 'Des rencontres pensées pour l’engagement',
    description:
      'La découverte de profils et la mise en relation sont conçues pour des liens sérieux et durables. La messagerie ne s’ouvre qu’une fois l’intérêt mutuel confirmé.',
  },
  {
    title: 'Un espace pensé pour la sécurité',
    description:
      'Signalement et blocage sont accessibles en un instant, à tout moment de l’échange, pour que chacun se sente respecté et protégé.',
  },
]

const QUOTES = [
  {
    text: 'Deux valent mieux qu’un, car ils retirent un bon salaire de leur travail.',
    reference: 'Ecclésiaste 4, 9-10',
  },
  {
    text: 'L’amour est patient, il est plein de bonté.',
    reference: '1 Corinthiens 13, 4',
  },
]

export default function LandingPage() {
  return (
    <>
      <header className="landing-nav">
        <BrandMark />
        <nav className="landing-nav-links">
          <Link href="/login" className="nav-link">
            Connexion
          </Link>
          <Link href="/register" className="btn-primary landing-nav-cta">
            Créer un compte
          </Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-content">
            <p className="landing-eyebrow">Rencontres chrétiennes</p>
            <h1>Bâtir une histoire d’amour enracinée dans la foi.</h1>
            <p className="landing-hero-subtitle">
              Alliance rassemble des célibataires chrétiens en quête d’une relation sérieuse et
              durable, portée par des valeurs communes plutôt que par les apparences.
            </p>
            <div className="landing-cta-group">
              <Link href="/register" className="btn-primary landing-cta-primary">
                Créer mon profil
              </Link>
              <Link href="/login" className="btn-ghost-dark">
                J’ai déjà un compte
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-section">
          <p className="section-eyebrow">Pourquoi Alliance</p>
          <h2 className="landing-section-title">Une approche différente de la rencontre</h2>
          <div className="feature-grid">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-quote-section">
          {QUOTES.map((quote) => (
            <blockquote key={quote.reference} className="landing-quote">
              <p>{quote.text}</p>
              <cite>{quote.reference}</cite>
            </blockquote>
          ))}
        </section>

        <section className="landing-final-cta">
          <h2>Prêt·e à commencer votre histoire ?</h2>
          <p>Créez votre profil en quelques minutes et rejoignez une communauté de célibataires sincères.</p>
          <Link href="/register" className="btn-primary landing-cta-primary">
            Créer mon profil gratuitement
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <BrandMark />
        <p>Alliance — Rencontres chrétiennes sérieuses, portées par la foi.</p>
      </footer>
    </>
  )
}
