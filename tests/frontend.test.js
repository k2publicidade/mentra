import test from "node:test";
import assert from "node:assert/strict";

test("API preserves server errors and same-origin cookie authentication", async () => {
  const { apiRequest } = await import("../src/lib.js");
  let observed;
  const result = await apiRequest(
    "/items",
    { method: "POST", body: { title: "Exames", type: "task" } },
    async (url, options) => {
      observed = { url, options };
      return new Response(JSON.stringify({ item: { title: "Exames" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  assert.equal(result.item.title, "Exames");
  assert.equal(observed.url, "/api/items");
  assert.equal(observed.options.credentials, "same-origin");
  assert.deepEqual(JSON.parse(observed.options.body), {
    title: "Exames",
    type: "task",
  });
  await assert.rejects(
    apiRequest(
      "/items",
      {},
      async () =>
        new Response(
          JSON.stringify({ error: "Limite de prioridades atingido." }),
          { status: 409 },
        ),
    ),
    /Limite de prioridades/,
  );
  await assert.rejects(
    apiRequest("/auth/me", {}, async () => new Response("{}", { status: 401 })),
    (error) => error.status === 401,
  );
});

test("foreground notification plans cancel completed, deleted, moved and expired items", async () => {
  const { notificationPlan } = await import("../src/lib.js");
  const now = Date.parse("2026-10-09T13:00:00Z");
  const items = [
    {
      id: "1",
      type: "reminder",
      title: "Contrato",
      status: "pending",
      dueAt: "2026-10-09T14:00:00Z",
    },
    {
      id: "2",
      type: "event",
      title: "Dentista",
      status: "completed",
      dueAt: "2026-10-09T14:00:00Z",
    },
    {
      id: "3",
      type: "task",
      title: "Atrasado",
      status: "pending",
      dueAt: "2026-10-09T12:00:00Z",
    },
    {
      id: "4",
      type: "memory",
      title: "Memória",
      status: "pending",
      dueAt: null,
    },
  ];
  const planned = notificationPlan(items, now, new Set());
  assert.equal(planned.length, 1);
  assert.equal(planned[0].delay, 3600000);
  assert.equal(
    notificationPlan(items, now, new Set([planned[0].key])).length,
    0,
  );
  const moved = notificationPlan(
    [{ ...items[0], dueAt: "2026-10-09T15:00:00Z" }],
    now,
    new Set([planned[0].key]),
  );
  assert.equal(moved.length, 1);
  assert.equal(moved[0].delay, 7200000);
  assert.deepEqual(notificationPlan([], now), []);
});

test("all four product surfaces render real server state and accessible action controls", async () => {
  const { createServer } = await import("vite");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const server = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const { Auth, Today, Life, Chat, Account } =
      await server.ssrLoadModule("/src/screens.jsx");
    const user = {
      name: "Ana",
      email: "ana@example.test",
      timezone: "America/Sao_Paulo",
      preferences: {},
      plan: "free",
    };
    const noop = () => {};
    const props = {
      user,
      items: [],
      messages: [],
      summary: {
        text: "Nenhum item registrado.",
        priorities: [],
        upcoming: [],
        pendingCount: 0,
      },
      integrations: {
        ai: "local",
        calendar: "export-only",
        whatsapp: "unconfigured",
        billing: "unconfigured",
        notifications: "browser-only",
      },
      onAction: noop,
      onEdit: noop,
      onChat: noop,
      onSave: noop,
      onLogout: noop,
      onDelete: noop,
      onNavigate: noop,
      onNotify: noop,
    };
    const auth = renderToStaticMarkup(createElement(Auth, { onSubmit: noop }));
    assert.match(auth, /autocomplete="email"/i);
    assert.match(auth, /Entrar/);
    assert.match(
      renderToStaticMarkup(createElement(Today, props)),
      /Nenhum item registrado/,
    );
    const life = renderToStaticMarkup(
      createElement(Life, {
        ...props,
        items: [
          {
            id: "x",
            type: "memory",
            title: "Preferência real",
            notes: "Sem café",
            source: "Informado por mim",
            status: "pending",
          },
        ],
      }),
    );
    assert.match(life, /Preferência real/);
    assert.match(life, /Informado por mim/);
    assert.match(life, /Editar/);
    const chat = renderToStaticMarkup(createElement(Chat, props));
    assert.match(chat, /Modo local/);
    assert.match(chat, /Enviar/);
    const account = renderToStaticMarkup(createElement(Account, props));
    assert.match(account, /Exportar/);
    assert.match(account, /não configurado/i);
    assert.match(account, /Excluir conta/);
  } finally {
    await server.close();
  }
});

test("application starts with a truthful loading state and no seeded records", async () => {
  const { createServer } = await import("vite");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const server = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const { default: App } = await server.ssrLoadModule("/src/App.jsx");
    const html = renderToStaticMarkup(createElement(App));
    assert.match(html, /Abrindo seu espaço/);
    assert.match(html, /role="status"/);
    assert.doesNotMatch(html, /Dentista|Contrato|Exames/);
  } finally {
    await server.close();
  }
});

test("API rejects a successful HTTP response with malformed JSON rather than claiming saved", async () => {
  const { apiRequest } = await import("../src/lib.js");
  await assert.rejects(
    apiRequest(
      "/items",
      { method: "POST", body: { type: "task", title: "Teste" } },
      async () => new Response("<html>Offline</html>", { status: 200 }),
    ),
    /resposta.*servidor/i,
  );
});

test("registration communicates the server password minimum and memory editor exposes source", async () => {
  const { createServer } = await import("vite");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const server = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const { Auth, ItemEditor, Field } =
      await server.ssrLoadModule("/src/screens.jsx");
    const field = renderToStaticMarkup(
      createElement(
        Field,
        { label: "Tipo", hint: "Escolha uma opção" },
        createElement("select", null, createElement("option", null, "Tarefa")),
      ),
    );
    assert.match(field, /<label[^>]*for=/);
    assert.match(field, /aria-describedby=/);
    const auth = renderToStaticMarkup(
      createElement(Auth, { initialRegister: true, onSubmit: () => {} }),
    );
    assert.match(auth, /minLength="10"/);
    assert.match(auth, /10 caracteres/);
    const editor = renderToStaticMarkup(
      createElement(ItemEditor, {
        item: {
          id: "m",
          type: "memory",
          title: "Café",
          source: "Anotação minha",
        },
        user: { timezone: "America/Sao_Paulo" },
        onSubmit: () => {},
        onClose: () => {},
      }),
    );
    assert.match(editor, /name="source"/);
    assert.match(editor, /Anotação minha/);
    assert.match(editor, /aria-modal="true"/);
  } finally {
    await server.close();
  }
});

test("onboarding saves timezone before capture and never duplicates a capture when final profile save is retried", async () => {
  const { createOnboardingFlow } = await import("../src/lib.js");
  const calls = [];
  let failFinal = true;
  const finish = createOnboardingFlow(
    async (path, options) => {
      calls.push({ path, body: options.body });
      if (path === "/profile" && options.body.onboarded && failFinal) {
        failFinal = false;
        throw new Error("offline");
      }
      return path === "/profile"
        ? { user: { ...options.body } }
        : { reply: "Salvei.", items: [] };
    },
    () => "stable-id",
  );
  const profile = { name: "Ana", timezone: "Europe/Lisbon", onboarded: true };
  await assert.rejects(
    finish(profile, "Me lembra amanhã às 9 de ligar"),
    /offline/,
  );
  assert.equal(calls[0].path, "/profile");
  assert.equal(calls[0].body.timezone, "Europe/Lisbon");
  assert.equal(calls[1].path, "/chat");
  await finish(profile, "Me lembra amanhã às 9 de ligar");
  assert.equal(calls.filter((call) => call.path === "/chat").length, 1);
  assert.equal(calls.at(-1).body.onboarded, true);
});

test('editor keeps server validation errors visible inside the active modal', async () => {
  const {createServer} = await import('vite');
  const {renderToStaticMarkup} = await import('react-dom/server');
  const {createElement} = await import('react');
  const server = await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  try {
    const {ItemEditor} = await server.ssrLoadModule('/src/screens.jsx');
    const html = renderToStaticMarkup(createElement(ItemEditor,{user:{timezone:'America/Sao_Paulo'},serverError:'Escolha no máximo três prioridades pendentes.',onClose:()=>{},onSubmit:()=>{}}));
    assert.match(html, /role="alert"[^>]*>Escolha no máximo três prioridades pendentes\./);
  } finally {await server.close();}
});

// Frontend utilities run in Node without a browser or provider credentials.
test("manual dates are interpreted in the account timezone, not the machine timezone", async () => {
  const { zonedInputToISO, toDateTimeInput } = await import("../src/lib.js");
  const iso = zonedInputToISO("2026-10-09T10:30", "America/Sao_Paulo");
  assert.equal(iso, "2026-10-09T13:30:00.000Z");
  assert.equal(toDateTimeInput(iso, "America/Sao_Paulo"), "2026-10-09T10:30");
  assert.equal(zonedInputToISO("", "America/Sao_Paulo"), null);
  assert.throws(
    () => zonedInputToISO("2026-02-30T10:30", "America/Sao_Paulo"),
    /inválid/,
  );
});
