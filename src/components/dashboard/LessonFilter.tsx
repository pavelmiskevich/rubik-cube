import Link from "next/link";
import type { Lesson } from "@/content/lessons";

/*
  Выбор «все сборки / конкретный урок» — обычные ссылки с `?lesson=`, а не
  состояние на клиенте: статистика считается на сервере по отфильтрованным
  сборкам, выбор переживает перезагрузку, им можно поделиться, и работает он
  без JavaScript. Вид — как у переключателя на /solve: выбранное залито
  акцентом, остальное — вторичные кнопки.
*/

const BASE =
  "inline-flex items-center justify-center rounded-control px-4 py-2 text-sm font-semibold";
const ACTIVE = "bg-accent text-white";
const IDLE = "border bg-surface-2 text-text hover:bg-surface";

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      // "true", а не "page": текущую страницу уже отмечает меню сайта, а здесь
      // отмечен выбранный вариант внутри набора.
      aria-current={active ? "true" : undefined}
      className={`${BASE} ${active ? ACTIVE : IDLE}`}
    >
      {children}
    </Link>
  );
}

export default function LessonFilter({
  lessons,
  selected,
}: {
  /** Уроки, по которым есть сборки, в порядке курса. */
  lessons: readonly Lesson[];
  /** Выбранный урок; `undefined` — все сборки. */
  selected?: Lesson;
}) {
  return (
    <nav aria-label="Какие сборки считать" data-testid="lesson-filter">
      <ul className="flex flex-wrap gap-2">
        <li>
          <FilterLink href="/stats" active={selected === undefined}>
            Все сборки
          </FilterLink>
        </li>
        {lessons.map((lesson) => (
          <li key={lesson.slug}>
            <FilterLink
              href={`/stats?lesson=${encodeURIComponent(lesson.slug)}`}
              active={selected?.slug === lesson.slug}
            >
              {lesson.title}
            </FilterLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
