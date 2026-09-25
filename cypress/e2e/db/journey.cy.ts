/**
 * Приёмочный сценарий с настоящей базой: путь человека от первого урока без
 * входа до статистики в аккаунте.
 *
 * Уроки без входа → регистрация → вход → прогресс переехал в аккаунт (#52) →
 * сборки на таймере сохранились → /stats их показывает, Ao5 совпадает с
 * расчётом по правилам WCA → сборка с урока помечена уроком и видна в выборе
 * (#83) → выход, ещё шаг без входа, повторный вход — ничего не задвоилось.
 *
 * Нужны база с миграциями и сервер с DATABASE_URL и AUTH_SECRET — набор
 * запускается `npm run test:e2e:db` или `npm run test:e2e:ci`. Что лежит в
 * базе, сценарий читает задачей `db:user` из cypress.config.ts: сохранённое
 * время в миллисекундах, урок у сборки и число строк интерфейс не показывает.
 */
import type { UserSnapshot } from "../../../cypress.config";

const LOCAL_PROGRESS_KEY = "rubik:lesson-progress:v1";
const PASSWORD = "e2e-password-1";

/** Время как на экране: секунды с сотыми, лишнее отбрасывается (`formatSolveTime`). */
function formatSeconds(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds}.${String(centiseconds).padStart(2, "0")}`;
}

/**
 * Ao5 по правилам WCA, посчитанное здесь заново, а не взятое из statistics.ts:
 * последние пять, без лучшей и худшей, среднее трёх, округление до сотых.
 */
function ao5(timesMs: number[]): string {
  const window = timesMs.slice(-5).sort((a, b) => a - b);
  const mean = (window[1] + window[2] + window[3]) / 3;
  return formatSeconds(Math.round(mean / 10) * 10);
}

const snapshot = (email: string) =>
  cy.task<UserSnapshot>("db:user", email, { log: false });

/**
 * Дождаться, пока React подхватит разметку элемента. Форма входа до гидратации
 * отправилась бы мимо серверного действия, а клавиши таймера ушли бы в никуда.
 */
function hydrated(selector: string) {
  return cy
    .get(selector)
    .should(($el) => {
      expect(Object.keys($el[0]).some((key) => key.startsWith("__reactProps"))).to.eq(true);
    });
}

// Урок — по aria-current шага, как в lesson-progress.cy.ts.
const steps = () => cy.get("ol > li > button");
const currentStep = () => cy.get('button[aria-current="step"]');

function openLesson(slug: string) {
  cy.visit(`/learn/${slug}`);
  cy.get("canvas").should("exist");
}

function playToEnd() {
  cy.contains("button", "Шаг вперёд").then(($button) => {
    if ($button.is(":disabled")) return;
    cy.wrap($button).click();
    playToEnd();
  });
}

const timer = () => cy.get('[data-testid="timer"]');

/**
 * Одна сборка клавиатурой: удержать пробел, отпустить, выждать, нажать. Ждём
 * ответа серверного действия saveSolve: без него переход на /stats обогнал бы
 * запись.
 *
 * Клавиши — на document, а не на body, как в timer.cy.ts: с историей из
 * базы страница длиннее экрана, и центр body, куда Cypress целит событие,
 * оказывается под шапкой. Таймер слушает window, и событие с document до него
 * всплывает.
 */
function solveOnce(holdMs: number) {
  cy.document().trigger("keydown", { code: "Space" });
  timer().should("have.attr", "data-state", "READY");
  cy.document().trigger("keyup", { code: "Space" });
  timer().should("have.attr", "data-state", "RUNNING");
  cy.wait(holdMs);
  cy.document().trigger("keydown", { code: "Space" });
  timer().should("have.attr", "data-state", "STOPPED");
  cy.wait("@saveSolve").its("response.statusCode").should("eq", 200);
  cy.document().trigger("keyup", { code: "Space" });
  timer().should("have.attr", "data-state", "IDLE");
  timer().find('[role="alert"]').should("not.exist");
}

function signIn(email: string) {
  cy.visit("/login");
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(PASSWORD, { log: false });
  hydrated('form button[type="submit"]').click();
  cy.location("pathname").should("eq", "/profile");
  cy.contains("h1", "Профиль").should("be.visible");
  // Прогресс без входа переехал в аккаунт, и локальная копия удалена.
  cy.window().should((win) => {
    expect(win.localStorage.getItem(LOCAL_PROGRESS_KEY)).to.eq(null);
  });
}

describe("Путь человека с базой", () => {
  it("от уроков без входа до статистики в аккаунте, без задвоений", () => {
    const email = `e2e-${Date.now()}-${Cypress._.random(1e6)}@example.test`;
    cy.intercept({ method: "POST", pathname: "/timer" }).as("saveSolve");

    cy.log("**Уроки без входа**");
    // Урок, открывающий скоростной блок, пройден до конца.
    openLesson("last-layer-permutation");
    steps().last().click();
    playToEnd();
    cy.get('[data-testid="lesson-completed"]').should("be.visible");
    // В кресте остановились на втором шаге.
    openLesson("cross");
    steps().eq(1).click();
    currentStep().should("contain.text", "2.");
    cy.window().then((win) => {
      expect(win.localStorage.getItem(LOCAL_PROGRESS_KEY)).to.be.a("string");
    });

    cy.log("**Регистрация**");
    cy.visit("/register");
    cy.get('input[name="name"]').type("Сквозной тест");
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(PASSWORD, { log: false });
    hydrated('form button[type="submit"]').click();
    cy.location("pathname").should("eq", "/login");
    cy.location("search").should("eq", "?registered=true");
    cy.contains("Регистрация успешна").should("be.visible");
    snapshot(email).its("users").should("eq", 1);

    cy.log("**Вход — прогресс переехал в аккаунт**");
    signIn(email);
    cy.visit("/learn");
    cy.get('[data-testid="lesson-progress-cross"]').should("contain.text", "шаге 2");
    cy.get('[data-testid="lesson-progress-last-layer-permutation"]').should(
      "contain.text",
      "Пройден"
    );
    // Скоростной блок открыт по прогрессу из базы, а не из браузера.
    cy.get('[data-testid="course-locked"]').should("not.exist");
    snapshot(email).then(({ progress }) => {
      expect(progress).to.have.length(2);
      expect(progress.find((row) => row.lessonSlug === "cross")).to.include({
        stepIndex: 1,
        completed: false,
      });
      expect(progress.find((row) => row.lessonSlug === "last-layer-permutation")).to.include({
        completed: true,
      });
    });

    cy.log("**Пять сборок на таймере**");
    cy.visit("/timer");
    hydrated('[data-testid="timer"]');
    cy.contains("Результаты сохраняются только для вошедших").should("not.exist");
    for (const holdMs of [300, 700, 500, 900, 400]) solveOnce(holdMs);
    cy.get('[data-testid="solve-list"] li').should("have.length", 5);

    cy.log("**/stats: сборки из базы и Ao5**");
    cy.visit("/stats");
    cy.get('[data-testid="solve-list"] li').should("have.length", 5);
    snapshot(email).then(({ solves, trainingSessions }) => {
      expect(trainingSessions).to.eq(1);
      expect(solves).to.have.length(5);
      expect(solves.every((solve) => solve.lessonSlug === null), "свободные сборки").to.eq(true);
      const times = solves.map((solve) => solve.timeMs);
      cy.get('[data-testid="ao5"]').should("have.text", ao5(times));
      // Список — свежие сверху, время как в базе.
      cy.get('[data-testid="solve-list"] li').each(($item, index) => {
        const ms = times[times.length - 1 - index];
        expect($item.text()).to.contain(`Сборка №${times.length - index}`);
        expect($item.text()).to.contain(formatSeconds(ms));
      });
    });
    // Урока ни у одной сборки нет — выбора урока нет.
    cy.get('[data-testid="lesson-filter"]').should("not.exist");

    cy.log("**Сборка с урока**");
    openLesson("paired-layers");
    cy.contains("Этот урок пока закрыт").should("not.exist");
    hydrated('[data-testid="practice-timer-link"]').click();
    cy.location("pathname").should("eq", "/timer");
    cy.location("search").should("eq", "?lesson=paired-layers");
    cy.get('[data-testid="practice-lesson"]').should("have.text", "Первые два слоя парами");
    hydrated('[data-testid="timer"]');
    // История из базы подхватилась и здесь.
    cy.get('[data-testid="solve-list"] li').should("have.length", 5);
    solveOnce(600);
    cy.get('[data-testid="solve-list"] li').should("have.length", 6);

    cy.visit("/stats");
    cy.get('[data-testid="solve-list"] li').should("have.length", 6);
    cy.contains('[data-testid="lesson-filter"] a', "Все сборки").should(
      "have.attr",
      "aria-current",
      "true"
    );
    snapshot(email).then(({ solves }) => {
      expect(solves).to.have.length(6);
      expect(solves[5].lessonSlug).to.eq("paired-layers");
      expect(solves.slice(0, 5).every((solve) => solve.lessonSlug === null)).to.eq(true);
      // Ao5 всех сборок — по пяти последним, включая сборку с урока.
      cy.get('[data-testid="ao5"]').should("have.text", ao5(solves.map((solve) => solve.timeMs)));
    });
    cy.contains('[data-testid="lesson-filter"] a', "Первые два слоя парами").click();
    cy.location("search").should("eq", "?lesson=paired-layers");
    cy.get('[data-testid="solve-list"] li').should("have.length", 1);
    cy.get('[data-testid="ao5"]').should("have.text", "ещё 4 до Ao5");

    cy.log("**Выход и ещё шаг без входа**");
    cy.visit("/profile");
    hydrated('main form button[type="submit"]').click();
    cy.location("pathname").should("eq", "/");
    cy.visit("/stats");
    cy.contains("Статистика появится после входа").should("be.visible");
    openLesson("cross");
    // Без входа прогресс аккаунта не виден: урок с первого шага.
    currentStep().should("contain.text", "1.");
    steps().eq(2).click();
    currentStep().should("contain.text", "3.");

    cy.log("**Повторный вход — ничего не задвоилось**");
    signIn(email);
    cy.visit("/learn");
    cy.get('[data-testid="lesson-progress-cross"]').should("contain.text", "шаге 3");
    cy.get('[data-testid="lesson-progress-last-layer-permutation"]').should(
      "contain.text",
      "Пройден"
    );
    cy.visit("/stats");
    cy.get('[data-testid="solve-list"] li').should("have.length", 6);
    snapshot(email).then(({ users, trainingSessions, solves, progress }) => {
      expect(users, "пользователей").to.eq(1);
      expect(trainingSessions, "тренировочных сессий").to.eq(1);
      expect(solves, "сборок").to.have.length(6);
      expect(progress, "строк прогресса").to.have.length(2);
      expect(progress.find((row) => row.lessonSlug === "cross")).to.include({
        stepIndex: 2,
        completed: false,
      });
    });
  });
});
