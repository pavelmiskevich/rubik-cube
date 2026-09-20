/**
 * Прогресс анонима: живёт в localStorage и переживает перезагрузку, пока
 * данные браузера не очищены. Вошедший пишет в базу тем же хуком — его путь
 * закрыт юнит-тестами серверного действия и ручной проверкой на стенде.
 *
 * Номер шага проверяется по aria-current, а не по тексту: тексты уроков
 * меняются, а открытый шаг помечен всегда.
 */
describe("Прогресс по урокам без входа", () => {
  const steps = () => cy.get("ol > li > button");
  const currentStep = () => cy.get('button[aria-current="step"]');
  const forward = () => cy.contains("button", "Шаг вперёд");

  /**
   * Открыть урок и дождаться гидратации. Клик по разметке, которую React ещё
   * не подхватил, уходит в никуда. Куб грузится отдельным чанком только в
   * браузере, так что появившийся canvas значит: проигрыватель ожил.
   */
  function openLesson() {
    cy.visit("/learn/cross");
    cy.get("canvas").should("exist");
  }

  /** Жать «Шаг вперёд», пока алгоритм шага не показан целиком. */
  function playToEnd() {
    forward().then(($button) => {
      if ($button.is(":disabled")) return;
      cy.wrap($button).click();
      playToEnd();
    });
  }

  it("запоминает шаг и отметку о прохождении до очистки данных браузера", () => {
    cy.visit("/learn");
    cy.get('[data-testid="lesson-progress-cross"]').should("not.exist");

    openLesson();
    currentStep().should("contain.text", "1.");
    steps().eq(1).click();
    currentStep().should("contain.text", "2.");

    // Вернулся — и урок открылся там, где остановился.
    cy.reload();
    cy.get("canvas").should("exist");
    currentStep().should("contain.text", "2.");

    cy.visit("/learn");
    cy.get('[data-testid="lesson-progress-cross"]').should("contain.text", "шаге 2");

    // Последний шаг показан до конца — урок пройден.
    openLesson();
    steps().last().click();
    playToEnd();
    cy.get('[data-testid="lesson-completed"]').should("be.visible");

    cy.visit("/learn");
    cy.get('[data-testid="lesson-progress-cross"]').should("contain.text", "Пройден");

    // Возврат к первому шагу отметку не снимает.
    openLesson();
    steps().first().click();
    cy.visit("/learn");
    cy.get('[data-testid="lesson-progress-cross"]').should("contain.text", "Пройден");

    cy.clearLocalStorage();
    cy.reload();
    cy.get('[data-testid="lesson-progress-cross"]').should("not.exist");
  });
});
