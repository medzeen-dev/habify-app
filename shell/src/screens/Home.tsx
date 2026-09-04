import { Header } from '../components/Header'
import './Home.css'

/** Placeholder landing after the Wizard. The full Home hub (Flow §3, DL-039/045) follows. */
export function Home() {
  return (
    <div className="h30-home">
      <Header />
      <main className="h30-home__content">
        <div className="h30-home__inner">
          <h1 className="t-display">Willkommen in deinem Programm</h1>
          <p className="t-body-lg text-secondary">
            Dein Zugang ist eingerichtet. Die Home-Ansicht entsteht als Nächstes.
          </p>
        </div>
      </main>
    </div>
  )
}
