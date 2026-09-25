/**
 * Обход сайта без входа: каждая страница отвечает 200 и не пишет ошибок в
 * консоль браузера. Необработанное исключение на странице Cypress роняет сам;
 * здесь ловится то, что React и библиотеки только печатают: расхождение
 * серверной и клиентской разметки, ключи списков, ошибки WebGL.
 *
 * Уроки берутся со страницы курса, а не из списка в сценарии: новый урок
 * попадёт в обход сам.
 */

/** Страницы, которые не видны из курса. */
const PAGES = ["/", "/learn", "/solve", "/timer", "/trainer", "/stats", "/login", "/register", "/styleguide"];

/** Страницы с 3D-кубом — кроме уроков, где он есть всегда. */
const CUBE_PAGES = new Set(["/", "/trainer"]);

/**
 * Скоростной блок открывается пройденным уроком метода слоёв. Без отметки его
 * уроки показывают только «пока закрыт», и проигрыватель с разборами случаев
 * в обход не попал бы.
 */
const OPEN_SPEED_BLOCK = JSON.stringify({
  "last-layer-permutation": { stepIndex: 0, completed: true },
});

function visitClean(path: string, withCube: boolean) {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem("rubik:lesson-progress:v1", OPEN_SPEED_BLOCK);
      cy.spy(win.console, "error").as("consoleError");
    },
  });
  cy.get("main").should("be.visible");
  // Куб грузится отдельным чанком и только в браузере: пока его нет,
  // страница ещё не ожила, и ошибки при гидратации впереди.
  if (withCube) cy.get("canvas").should("exist");
  // Эффекты после гидратации успевают отработать.
  cy.wait(300);
  cy.get("@consoleError").then((spy) => {
    const calls = (spy as unknown as sinon.SinonSpy).getCalls();
    const messages = calls.map((call) => call.args.map(String).join(" "));
    expect(messages, `ошибки в консоли на ${path}`).to.deep.equal([]);
  });
}

describe("Обход страниц", () => {
  it("каждая страница отвечает 200", () => {
    for (const path of PAGES) {
      cy.request(path).its("status").should("eq", 200);
    }
    // Профиль без входа уводит на вход, а не падает.
    cy.request({ url: "/profile", followRedirect: false }).then((response) => {
      expect(response.status).to.be.within(300, 399);
      expect(response.headers.location).to.match(/\/login$/);
    });
    cy.request({ url: "/no-such-page", failOnStatusCode: false })
      .its("status")
      .should("eq", 404);
  });

  it("страницы без ошибок в консоли", () => {
    for (const path of PAGES) visitClean(path, CUBE_PAGES.has(path));
  });

  it("уроки курса отвечают 200 и без ошибок в консоли", () => {
    cy.visit("/learn");
    cy.get('main a[href^="/learn/"]').then(($links) => {
      const lessons = [...new Set([...$links].map((link) => link.getAttribute("href") as string))];
      // Шестнадцать уроков в двух блоках; меньше — значит, список не дорисовался.
      expect(lessons.length, "уроков на странице курса").to.be.at.least(16);
      for (const path of lessons) {
        cy.request(path).its("status").should("eq", 200);
        visitClean(path, true);
        cy.contains("Этот урок пока закрыт").should("not.exist");
      }
    });
  });
});
