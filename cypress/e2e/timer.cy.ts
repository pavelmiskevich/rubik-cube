/**
 * Селекторы — только data-testid. Первая версия цеплялась за классы Tailwind
 * (`div.font-mono`), выбирала несколько элементов и ломалась от любой правки
 * оформления.
 */
describe("Рабочий экран", () => {
  const timer = () => cy.get('[data-testid="timer"]');
  const display = () => cy.get('[data-testid="timer-display"]');

  /** Одна сборка: удержать пробел, отпустить, дать часам идти, остановить. */
  function solveOnce() {
    cy.get("body").trigger("keydown", { code: "Space" });
    timer().should("have.attr", "data-state", "READY");
    cy.get("body").trigger("keyup", { code: "Space" });
    timer().should("have.attr", "data-state", "RUNNING");
    cy.wait(150);
    cy.get("body").trigger("keydown", { code: "Space" });
    timer().should("have.attr", "data-state", "STOPPED");
    cy.get("body").trigger("keyup", { code: "Space" });
    timer().should("have.attr", "data-state", "IDLE");
  }

  it("выдаёт скрамбл, засекает время и считает средние", () => {
    cy.visit("/timer");

    cy.get('[data-testid="scramble"]')
      .should("not.have.text", "Генерация...")
      .invoke("text")
      .then((first) => {
        cy.get('[data-testid="new-scramble"]').click();
        cy.get('[data-testid="scramble"]')
          .invoke("text")
          .should((next) => {
            expect(next).to.match(/^[UDLRFB]['2]?( [UDLRFB]['2]?){19}$/);
            expect(next).to.not.equal(first);
          });
      });

    timer().should("have.attr", "data-state", "IDLE");
    cy.get('[data-testid="ao5"]').should("have.text", "-");

    // Скрамбл должен смениться сам после сборки.
    cy.get('[data-testid="scramble"]')
      .invoke("text")
      .then((before) => {
        solveOnce();
        display()
          .invoke("text")
          .should((text) => {
            expect(Number.parseFloat(text)).to.be.greaterThan(0);
          });
        cy.get('[data-testid="scramble"]')
          .invoke("text")
          .should((after) => {
            expect(after).to.not.equal(before);
          });
      });

    cy.get('[data-testid="solve-list"] li').should("have.length", 1);

    // Ao5 появляется ровно на пятой сборке, не раньше.
    for (let i = 0; i < 3; i++) {
      solveOnce();
    }
    cy.get('[data-testid="solve-list"] li').should("have.length", 4);
    cy.get('[data-testid="ao5"]').should("have.text", "-");

    solveOnce();
    cy.get('[data-testid="solve-list"] li').should("have.length", 5);
    cy.get('[data-testid="ao5"]').should("not.have.text", "-");
    cy.get('[data-testid="ao12"]').should("have.text", "-");
  });

  it("не показывает чужую статистику тому, кто не вошёл", () => {
    cy.visit("/stats");
    cy.contains("Статистика появится после входа").should("be.visible");
    cy.contains("a", "Войти").should("have.attr", "href", "/login");
  });
});
