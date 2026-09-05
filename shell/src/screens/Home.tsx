import { Nav } from '../components/Nav'
import { Footer } from '../components/Footer'
import { FloatingCoach } from '../components/FloatingCoach'
import { Hero } from './home/Hero'
import { TaskList } from './home/TaskList'
import { WebinarCard } from './home/WebinarCard'
import { CoachCard } from './home/CoachCard'
import { DEMO_HOME, type HomeModel } from './home/homeData'
import './Home.css'

/**
 * Home hub — the participant's always-reachable landing tab, default on every return
 * visit (DL-039). Structure (DL-045, after the DL-052/DL-061 corrections that removed
 * the prompt area entirely): Nav · Hero (+ Momentum-waiting info block) · task list
 * (deadline list) · webinars + coach two-column section · footer · floating coach.
 *
 * Data is the presentational demo model for now (real phase/progress data is owned by
 * DL-076; cohort schedule shape TBD). Pass `data` to override.
 */
export function Home({ data = DEMO_HOME }: { data?: HomeModel }) {
  return (
    <div className="h30-home">
      <Nav tabs={data.tabs} />

      <main className="h30-home__content">
        <div className="h30-home__col">
          <Hero hero={data.hero} />

          {data.tasks.length > 0 && <TaskList tasks={data.tasks} />}

          <div className="h30-home__duo">
            <WebinarCard webinars={data.webinars} />
            <CoachCard coach={data.coach} />
          </div>
        </div>
      </main>

      <Footer />
      <FloatingCoach />
    </div>
  )
}
