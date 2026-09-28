/**
 * Выход из аккаунта остаётся в силе (#104, TECHDEBT 12).
 *
 * Ответ `GET /api/auth/session` переподписывал JWT и заново ставил cookie
 * сессии — так библиотека продлевает её срок. Клиент спрашивает сессию при
 * каждой загрузке страницы, и если такой запрос ушёл до выхода, а ответ
 * пришёл после, cookie возвращалась, и человек снова «вошёл». На `next dev`,
 * где первый запрос к адресу компилируется секундами, выход сразу после
 * загрузки профиля так иногда и не срабатывал. Теперь чтение сессии cookie не
 * ставит — её пишут только вход и выход.
 *
 * Рядом был второй дефект: кнопка в профиле выходила серверным действием с
 * мягким переходом, и шапка до перезагрузки показывала «Профиль / Выйти».
 */
const PASSWORD = "e2e-password-1";

const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Cypress._.random(1e6)}@example.test`;

/**
 * Каждый сценарий — со своего адреса клиента, как за прокси на проде (так же
 * в login-limit.cy.ts): регистрации ограничены пятью на адрес, и без этого
 * три сценария здесь, сквозной сценарий и перезапуски упавших делили бы один
 * счётчик.
 */
function ownClientAddress() {
  const ip = `203.0.113.${Cypress._.random(1, 254)}`;
  cy.intercept({ url: "/**" }, (req) => {
    req.headers["x-forwarded-for"] = ip;
  });
}

/** Кнопка, которую React уже подхватил: клик по голой разметке теряется. */
function hydrated(selector: string) {
  return cy.get(selector).should(($el) => {
    expect(Object.keys($el[0]).some((key) => key.startsWith("__reactProps"))).to.eq(true);
  });
}

function registerAndSignIn(email: string) {
  cy.visit("/register");
  cy.get('input[name="name"]').type("Выход");
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(PASSWORD, { log: false });
  hydrated('form button[type="submit"]').click();
  cy.location("pathname").should("eq", "/login");

  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(PASSWORD, { log: false });
  hydrated('form button[type="submit"]').click();
  // Первый вход на холодном `next dev` компилирует действие входа — дольше
  // обычного ожидания.
  cy.location("pathname", { timeout: 30000 }).should("eq", "/profile");
  cy.contains("h1", "Профиль").should("be.visible");
}

const signOutInProfile = () => hydrated('main button:contains("Выйти")').click();

function expectNoSessionCookie() {
  cy.getCookies().then((cookies) => {
    expect(
      cookies.map((cookie) => cookie.name).filter((name) => name.includes("session-token")),
      "cookie сессии"
    ).to.deep.eq([]);
  });
}

/** Выход виден и в шапке, и на странице, которой нужен вход. */
function expectSignedOut() {
  expectNoSessionCookie();
  cy.contains("nav a", "Войти").should("be.visible");
  cy.contains("nav button", "Выйти").should("not.exist");
  cy.visit("/stats");
  cy.contains("Статистика появится после входа").should("be.visible");
}

describe("Выход из аккаунта", () => {
  beforeEach(ownClientAddress);

  it("опоздавший ответ чтения сессии не возвращает вход", () => {
    registerAndSignIn(uniqueEmail("logout-late"));

    // Cookie, с которым ушёл бы запрос сессии, отправленный до выхода.
    cy.getCookie("authjs.session-token").should("exist").then((cookie) => {
      signOutInProfile();
      cy.location("pathname").should("eq", "/");
      expectNoSessionCookie();

      // Тот самый запрос: пришёл на сервер со старым cookie, а ответ — уже
      // после выхода. Ответ cy.request применяется к браузеру, как у fetch.
      cy.request({
        url: "/api/auth/session",
        headers: { Cookie: `authjs.session-token=${cookie!.value}` },
      })
        .its("headers")
        .should("not.have.property", "set-cookie");
    });
    expectSignedOut();
  });

  it("кнопкой в профиле — шапка сразу видит выход", () => {
    registerAndSignIn(uniqueEmail("logout-profile"));

    cy.visit("/profile");
    signOutInProfile();
    cy.location("pathname").should("eq", "/");
    expectSignedOut();
  });

  it("кнопкой в шапке", () => {
    registerAndSignIn(uniqueEmail("logout-header"));

    cy.visit("/profile");
    hydrated('nav button:contains("Выйти")').click();
    // Выход из шапки остаётся на той же странице, а профиль без входа ведёт ко входу.
    cy.location("pathname").should("eq", "/login");
    expectSignedOut();
  });
});
