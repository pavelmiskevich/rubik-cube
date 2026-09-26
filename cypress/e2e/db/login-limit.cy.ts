/**
 * Лимит входа по паролю (#101) на живом сервере с базой.
 *
 * Главное — что лимит нельзя обойти прямым запросом на адрес входа
 * библиотеки, мимо формы: раньше он стоял только в форме. Пять неудач на
 * пару «адрес + email» — дальше отказ с кодом rate_limited и на прямом адресе,
 * и в форме; другая почта с того же адреса при этом входит.
 *
 * Счётчики живут в памяти сервера до конца прогона, поэтому почты — свои на
 * каждый запуск.
 *
 * Адрес клиента задаётся заголовком X-Forwarded-For, как его ставит прокси на
 * проде. Без него сервер видит у запросов Cypress и у браузера разные адреса
 * (127.0.0.1 и ::1) — для ограничителя это два разных человека, и сценарий
 * проверял бы не правило, а устройство тестового стенда.
 */
const run = Date.now();
const victim = `limit-victim-${run}@example.com`;
const neighbour = `limit-neighbour-${run}@example.com`;
const PASSWORD = "e2e-password-1";
const CLIENT_IP = "198.51.100.77";

/** Все запросы браузера — с одного адреса клиента, как за прокси. */
function behindProxy() {
  cy.intercept({ url: "/**" }, (req) => {
    req.headers["x-forwarded-for"] = CLIENT_IP;
  });
}

/** Кнопка формы, которую React уже подхватил: клик по голой разметке теряется. */
function hydrated(selector: string) {
  return cy.get(selector).should(($el) => {
    expect(Object.keys($el[0]).some((key) => key.startsWith("__reactProps"))).to.eq(true);
  });
}

function register(email: string) {
  cy.visit("/register");
  cy.get('input[name="name"]').type("Сосед");
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(PASSWORD);
  hydrated('form button[type="submit"]').click();
  cy.location("search").should("eq", "?registered=true");
}

/** Вход прямым запросом на адрес библиотеки, как это сделал бы скрипт подбора. */
function directLogin(email: string, password: string) {
  return cy.request("/api/auth/csrf").then(({ body }) =>
    cy.request({
      method: "POST",
      url: "/api/auth/callback/credentials",
      form: true,
      followRedirect: false,
      failOnStatusCode: false,
      headers: { "x-forwarded-for": CLIENT_IP },
      body: { csrfToken: body.csrfToken, email, password },
    })
  );
}

const locationOf = (response: Cypress.Response<unknown>) =>
  String(response.headers.location ?? response.redirectedToUrl ?? "");

describe("Лимит входа по паролю", () => {
  before(() => {
    register(victim);
    cy.clearCookies();
    register(neighbour);
    cy.clearCookies();
  });

  it("прямой запрос мимо формы упирается в тот же лимит", () => {
    for (let i = 0; i < 5; i++) {
      directLogin(victim, `wrong-${i}`).then((response) => {
        expect(locationOf(response)).to.contain("error=CredentialsSignin");
        expect(locationOf(response)).not.to.contain("rate_limited");
      });
    }

    // Шестая — отказ по лимиту, даже с верным паролем.
    directLogin(victim, PASSWORD).then((response) => {
      expect(locationOf(response)).to.contain("code=rate_limited");
    });
  });

  it("форма показывает «Слишком много попыток», а не «неверный пароль»", () => {
    behindProxy();
    cy.visit("/login");
    cy.get('input[name="email"]').type(victim);
    cy.get('input[name="password"]').type(PASSWORD);
    hydrated('form button[type="submit"]').click();

    cy.contains("Слишком много попыток").should("be.visible");
    cy.location("pathname").should("eq", "/login");
  });

  it("сосед за тем же адресом со своей почтой входит", () => {
    behindProxy();
    cy.visit("/login");
    cy.get('input[name="email"]').type(neighbour);
    cy.get('input[name="password"]').type(PASSWORD);
    hydrated('form button[type="submit"]').click();

    cy.location("pathname").should("eq", "/profile");
  });
});
