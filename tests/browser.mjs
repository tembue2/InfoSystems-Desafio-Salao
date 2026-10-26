// UI isolation test: API responses are fixtures; database rules have separate SQL tests.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium: pw } = require(
  process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + "/playwright" : "playwright",
);
await fs.mkdir("../qa", {recursive:true});
const server = spawn(
  "node",
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--port",
    "3100",
    "--hostname",
    "127.0.0.1",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
let browser;
const findings = [];
try {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch("http://127.0.0.1:3100/entrar")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  for (const role of ["manager", "reception", "professional", "customer"]) {
    browser = await pw.launch({
      executablePath:
        process.env.QA_CHROMIUM_PATH || pw.executablePath(),
      args: [
        "--no-sandbox",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--no-zygote",
        "--single-process",
      ],
      headless: true,
    });
    const context = await browser.newContext();
    const uid = "00000000-0000-4000-a000-000000000001";
    const token = [
      "e30",
      Buffer.from(
        JSON.stringify({
          sub: uid,
          exp: Math.floor(Date.now() / 1000) + 3600,
          role: "authenticated",
        }),
      ).toString("base64url"),
      "mock",
    ].join(".");
    await context.addInitScript(
      ({ uid, token }) => {
        if (location.origin === "null") return;
        localStorage.setItem(
          "sb-rslyimjlwvvgnwfohzmr-auth-token",
          JSON.stringify({
            access_token: token,
            refresh_token: "fixture",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: "bearer",
            user: {
              id: uid,
              email: "fixture@example.invalid",
              aud: "authenticated",
            },
          }),
        );
      },
      { uid, token },
    );
    await context.route(
      "https://rslyimjlwvvgnwfohzmr.supabase.co/**",
      async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        let data = [];
        const object = req.headers()["accept"]?.includes("vnd.pgrst.object");
        const service = {
          id: "00000000-0000-4000-b000-000000000001",
          name: "Serviço de teste",
          description: "Dados simulados para validação visual.",
          price_mzn: 650,
          duration_minutes: 60,
          active: true,
        };
        const professional = {
          id: "00000000-0000-4000-b000-000000000002",
          profile_id: uid,
          display_name: "Profissional de teste",
          active: true,
        };
        const payment = {
          id: "00000000-0000-4000-c000-000000000001",
          amount_mzn: 650,
          validation_status: "validated",
          reference: "QA",
          received_at: new Date().toISOString(),
          validated_at: new Date().toISOString(),
          registered_by: uid,
          validated_by: uid,
          method: "cash",
          refunded_at: null,
        };
        const booking = {
          id: "00000000-0000-4000-d000-000000000001",
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 3600000).toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          price_mzn: 650,
          status: "confirmed",
          clients: { full_name: "Cliente de teste", phone: "840000000" },
          services: { name: service.name },
          professionals: { display_name: professional.display_name },
          payments: [payment],
        };
        if (url.pathname.includes("/auth/v1/user"))
          data = {
            id: uid,
            email: "fixture@example.invalid",
            aud: "authenticated",
          };
        else if (url.pathname.includes("/rpc/finance_summary"))
          data = { receipts: 650, other: 0, expenses: 100, refunds: 0 };
        else if (url.pathname.includes("/rpc/low_stock")) data = 1;
        else if (url.pathname.includes("/rpc/available_slots"))
          data = [
            { slot_start: new Date(Date.now() + 86400000).toISOString() },
          ];
        else {
          const table = url.pathname.split("/").pop();
          const tables = {
            profiles: [
              {
                id: uid,
                role,
                full_name: "Pessoa de teste",
                phone: "840000000",
                birth_date: null,
              },
            ],
            services: [service],
            professionals: [professional],
            professional_services: [
              {
                professional_id: professional.id,
                service_id: service.id,
                professionals: professional,
              },
            ],
            clients: [
              {
                id: uid,
                full_name: "Cliente de teste",
                phone: "840000000",
                email: "fixture@example.invalid",
              },
            ],
            bookings: [booking],
            payments: [payment],
            products: [
              {
                id: uid,
                name: "Champô de teste",
                kind: "consumable",
                quantity: 2,
                min_quantity: 5,
                active: true,
                sale_price_mzn: null,
              },
            ],
            work_hours: [
              {
                id: uid,
                professional_id: professional.id,
                weekday: 1,
                opens: "08:00",
                closes: "17:00",
              },
            ],
            time_off: [],
            stock_movements: [],
            audit_events: [],
            expenses: [],
            manual_income: [],
            salon_settings: [
              {
                id: true,
                hold_minutes: 60,
                policy_text: "Política de teste.",
                policy_approved: false,
              },
            ],
          };
          data = tables[table] || [];
        if(table === "payments" && url.searchParams.has("refunded_at")) data=[];
          if (object) data = data[0] || {};
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "access-control-allow-origin": "*",
          "access-control-expose-headers": "content-range",
            "content-range": "0-0/1",
          },
          body: req.method() === "HEAD" ? "" : JSON.stringify(data),
        });
      },
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const paths =
      role === "manager"
        ? [
            "/admin",
            "/admin/clientes",
            "/admin/servicos",
            "/admin/profissionais",
            "/admin/horarios",
            "/admin/pagamentos?booking=00000000-0000-4000-d000-000000000001",
            "/admin/financas",
            "/admin/inventario",
            "/admin/definicoes",
            "/admin/nova-marcacao",
            "/perfil",
          ]
        : role === "professional"
          ? ["/admin", "/admin/horarios", "/admin/financas"]
          : role === "reception"
            ? [
                "/admin",
                "/admin/clientes",
                "/admin/pagamentos",
                "/admin/financas",
              ]
            : [
                "/catalogo",
                "/reservar",
                "/minhas-marcacoes",
                "/perfil",
                "/admin",
              ];
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 950 });
      for (const path of paths) {
        await page.goto("http://127.0.0.1:3100" + path, {
          waitUntil: "networkidle",
        });
        await page.waitForTimeout(100);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        const denied = await page
          .getByText("Acesso não autorizado", { exact: true })
          .count();
        if (overflow) throw new Error(`Overflow ${role} ${width} ${path}`);
        if (
          ((path === "/admin/financas" && role !== "manager") ||
            (path === "/admin" && role === "customer")) &&
          !denied
        )
          throw new Error("Missing frontend permission gate");
        findings.push({ role, width, path, overflow, denied: Boolean(denied) });
        if (role === "manager" && path === "/admin" && width === 1440)
          await page.screenshot({
            path: "../qa/dashboard.png",
            fullPage: true,
          });
        if (role === "manager" && path === "/admin/servicos" && width === 390) {
          await page
            .getByRole("button", { name: "Adicionar", exact: true })
            .click();
          await page
            .getByLabel("Nome", { exact: true })
            .fill("Teste de formulário");
          await page.screenshot({
            path: "../qa/mobile-form.png",
            fullPage: true,
          });
        }
        if (path.startsWith("/admin/pagamentos?") && width === 1440) {
          await page.getByRole("button", { name: "Abrir recibo" }).click();
          await page.emulateMedia({ media: "print" });
          await page.screenshot({ path: "../qa/receipt.png", fullPage: true });
          await page.emulateMedia({ media: "screen" });
        }
      }
    }
    if (errors.length) throw new Error(errors.join("\n"));
    await context.close();
    await browser.close();
  }
  await fs.writeFile(
    "../qa/browser-results.json",
    JSON.stringify(findings, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: findings.length,
      viewports: [1440, 390],
      api: "simulated",
      javascriptErrors: 0,
      overflow: 0,
    }),
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await fs.writeFile("../qa/server.log", serverLog);
}
