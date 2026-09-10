/**
 * Selectors here are data-testid only. The first version of this spec matched
 * on Tailwind classes (`div.font-mono`), which selects several elements per
 * page and breaks the moment someone restyles a component.
 */
describe("Основной поток", () => {
  it("генерирует скрамбл, засекает время и показывает статистику", () => {
    cy.visit("/");

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

    cy.contains("a", "Таймер").click();
    cy.url().should("include", "/timer");

    const timer = () => cy.get('[data-testid="timer"]');
    const display = () => cy.get('[data-testid="timer-display"]');

    timer().should("have.attr", "data-state", "IDLE");

    // Hold space to arm, release to start.
    cy.get("body").trigger("keydown", { code: "Space" });
    timer().should("have.attr", "data-state", "READY");
    display().should("have.text", "0.00");

    cy.get("body").trigger("keyup", { code: "Space" });
    timer().should("have.attr", "data-state", "RUNNING");

    // Let the clock actually advance before stopping it.
    cy.wait(500);
    cy.get("body").trigger("keydown", { code: "Space" });

    timer().should("have.attr", "data-state", "STOPPED");
    display()
      .invoke("text")
      .should((text) => {
        expect(parseFloat(text)).to.be.greaterThan(0);
      });

    cy.visit("/stats");
    cy.contains("h2", "Статистика").should("be.visible");
    cy.get('[data-testid="ao5"]').should("not.have.text", "-");
    cy.get('[data-testid="solve-list"] li').should("have.length.greaterThan", 0);
  });
});
