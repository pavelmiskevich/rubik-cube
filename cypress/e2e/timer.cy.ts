describe("Rubiks Cube E2E", () => {
  it("should generate scramble, run timer, and display result in stats", () => {
    // 1. Visit the home page
    cy.visit("/");

    // 2. Check scramble is generated
    cy.get("div.font-mono").should("not.have.text", "Генерация...");

    // 3. Go to timer page
    cy.get("a").contains("Таймер").click();
    cy.url().should("include", "/timer");

    // 4. Test timer
    // Timer is in IDLE. Press and hold space -> READY (green) -> release -> RUNNING.
    cy.get("body").trigger("keydown", { code: "Space", force: true });
    
    // UI should show ready state (text-green-500)
    cy.get("div.font-mono").should("have.class", "text-green-500");
    cy.get("div.font-mono").should("have.text", "0.00");

    cy.get("body").trigger("keyup", { code: "Space", force: true });
    
    // UI should show running (starts increasing time). We'll wait a bit.
    cy.wait(500);

    // Stop timer
    cy.get("body").trigger("keydown", { code: "Space", force: true });
    
    // Let's check it's stopped and text is changed to gray-600
    cy.get("div.font-mono").should("have.class", "text-gray-600");
    cy.get("div.font-mono").invoke("text").should((text) => {
      expect(parseFloat(text)).to.be.greaterThan(0);
    });

    // 5. Go to stats page
    cy.visit("/stats");
    cy.url().should("include", "/stats");

    // Check stats are rendered
    cy.get("h2").contains("Статистика").should("be.visible");
    cy.get("li").should("have.length.greaterThan", 0);
  });
});
