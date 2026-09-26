import { defineConfig } from "cypress";

/*
  Два набора сценариев, и разделены они каталогом:

  - cypress/e2e/*.cy.ts — без базы. Идут на голом `next dev` (`npm run
    test:e2e`), в том числе в проверке перед выкладкой, где базы нет.
  - cypress/e2e/db/*.cy.ts — с базой: вход, запись сборок, слияние прогресса.
    Им нужны DATABASE_URL с применёнными миграциями и AUTH_SECRET у сервера;
    запускаются явно (`npm run test:e2e:db`, `npm run test:e2e:ci`).

  specPattern по умолчанию — только первый набор: сценарий с базой, случайно
  попавший в прогон без неё, упал бы на регистрации, и искать причину пришлось
  бы по логам сервера. Второй набор скрипты включают через
  `--config specPattern=...` (package.json).
*/

/** Что лежит в базе у пользователя — для проверок, которых не видно в интерфейсе. */
export interface UserSnapshot {
  users: number;
  trainingSessions: number;
  solves: { timeMs: number; lessonSlug: string | null }[];
  progress: { lessonSlug: string; stepIndex: number; completed: boolean }[];
}

async function userSnapshot(email: string): Promise<UserSnapshot> {
  // pg — зависимость приложения; грузится лениво, чтобы набор без базы не
  // зависел от неё вовсе.
  const { Client } = await import("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const users = await client.query<{ id: string }>(
      'SELECT id FROM "User" WHERE email = $1',
      [email]
    );
    const ids = users.rows.map((row) => row.id);
    const sessions = await client.query<{ count: string }>(
      'SELECT count(*) FROM "TrainingSession" WHERE "userId" = ANY($1)',
      [ids]
    );
    const solves = await client.query<{ timeMs: number; lessonSlug: string | null }>(
      `SELECT s."timeMs", s."lessonSlug" FROM "Solve" s
         JOIN "TrainingSession" t ON t.id = s."trainingSessionId"
        WHERE t."userId" = ANY($1)
        ORDER BY s."createdAt", s.id`,
      [ids]
    );
    const progress = await client.query<UserSnapshot["progress"][number]>(
      `SELECT "lessonSlug", "stepIndex", completed FROM "LessonProgress"
        WHERE "userId" = ANY($1) ORDER BY "lessonSlug"`,
      [ids]
    );
    return {
      users: ids.length,
      trainingSessions: Number(sessions.rows[0].count),
      solves: solves.rows,
      progress: progress.rows,
    };
  } finally {
    await client.end();
  }
}

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    specPattern: "cypress/e2e/*.cy.ts",
    supportFile: false,
    video: false,
    // `next dev` compiles each route on first request, which can outlast the
    // default 4s assertion timeout on a cold CI runner.
    defaultCommandTimeout: 10000,
    retries: { runMode: 2, openMode: 0 },
    setupNodeEvents(on) {
      on("task", {
        /** Снимок данных пользователя по email. Нужен только набору с базой. */
        "db:user"(email: string) {
          if (!process.env.DATABASE_URL) {
            throw new Error("db:user: DATABASE_URL не задан — сценарий с базой запущен без неё");
          }
          return userSnapshot(email);
        },
      });
    },
  },
});
