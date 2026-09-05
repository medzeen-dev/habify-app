import { ListChecks, Circle, ChevronRight } from 'lucide-react'
import type { TaskModel } from './homeData'
import { TASKS_EMPTY_LINE } from './homeData'

/**
 * Home task list — a DEADLINE list, not a checklist (DL-052). Items appear once the
 * course has explained their context; date tags are brand-colour (never red, DL-043);
 * items without a deadline carry no tag; nothing is greyed out. The whole section
 * disappears when empty — the empty line here is for the reference/empty variant only.
 */
export function TaskList({
  tasks,
  onOpen,
}: {
  tasks: TaskModel[]
  onOpen?: (id: string) => void
}) {
  return (
    <section className="h30-tasks">
      <header className="h30-tasks__head">
        <ListChecks size={20} aria-hidden="true" className="h30-tasks__head-icon" />
        <h2 className="t-heading-md">Was du tun kannst</h2>
      </header>

      {tasks.length === 0 ? (
        <p className="t-body-md h30-tasks__empty">{TASKS_EMPTY_LINE}</p>
      ) : (
        <ul className="h30-tasks__list">
          {tasks.map((task) => (
            <li key={task.id}>
              <button type="button" className="h30-task" onClick={() => onOpen?.(task.id)}>
                <Circle size={20} aria-hidden="true" className="h30-task__marker" />
                <span className="h30-task__body">
                  <span className="t-heading-sm h30-task__title">{task.title}</span>
                  <span className="t-body-sm h30-task__desc">{task.desc}</span>
                </span>
                {task.deadlineTag && <span className="h30-task__tag">{task.deadlineTag}</span>}
                <ChevronRight size={20} aria-hidden="true" className="h30-task__chevron" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
