/**
 * Шапка на телефоне (#58): разделы на виду, вход и тема — под кнопкой «Меню».
 * 390 px — ширина распространённого телефона, на ней шапка раньше занимала
 * четыре ряда.
 */
describe("Шапка на телефоне", () => {
  const menuButton = () => cy.get("nav button[aria-expanded]");
  const section = (label: string) => cy.contains("nav ul a", label);

  beforeEach(() => {
    cy.viewport(390, 844);
    cy.visit("/");
    // Кнопка оживает после гидратации; до неё клик ушёл бы в никуда.
    cy.get("canvas").should("exist");
  });

  it("держит разделы на виду, а вход прячет под «Меню»", () => {
    for (const label of ["Учиться", "Таймер", "Тренажёр", "Статистика"]) {
      section(label).should("be.visible");
    }
    menuButton().should("be.visible").and("have.text", "Меню");
    menuButton().should("have.attr", "aria-expanded", "false");
    cy.contains("nav a", "Войти").should("not.be.visible");

    // Два ряда: логотип с кнопкой и разделы.
    cy.get("nav").invoke("outerHeight").should("be.lessThan", 130);

    menuButton().click();
    menuButton().should("have.attr", "aria-expanded", "true").and("have.text", "Закрыть");
    cy.contains("nav a", "Войти").should("be.visible");
    cy.contains("nav a", "Регистрация").should("be.visible");

    // Escape закрывает меню.
    cy.get("body").type("{esc}");
    menuButton().should("have.attr", "aria-expanded", "false");
    cy.contains("nav a", "Войти").should("not.be.visible");

    // Переход из меню закрывает его.
    menuButton().click();
    cy.contains("nav a", "Войти").click();
    cy.location("pathname").should("eq", "/login");
    cy.contains("h1", "Вход в аккаунт").should("be.visible");
    menuButton().should("have.attr", "aria-expanded", "false");
  });

  it("ведёт по разделам и отмечает текущий", () => {
    const routes: [string, string, string][] = [
      ["Учиться", "/learn", "Научиться собирать"],
      ["Таймер", "/timer", "Таймер"],
      ["Тренажёр", "/trainer", "3D-тренажёр"],
      ["Статистика", "/stats", "Статистика появится после входа"],
    ];
    for (const [label, path, heading] of routes) {
      section(label).click();
      cy.location("pathname").should("eq", path);
      section(label).should("have.attr", "aria-current", "page");
      cy.contains("main h1, main h2", heading).should("be.visible");
    }
    // Вложенный маршрут подсвечивает свой раздел.
    cy.visit("/learn/cross");
    section("Учиться").should("have.attr", "aria-current", "page");
    section("Таймер").should("not.have.attr", "aria-current");
  });
});
