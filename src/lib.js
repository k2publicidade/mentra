export async function apiRequest(
  path,
  options = {},
  fetcher = globalThis.fetch,
) {
  const { body, ...rest } = options;
  const response = await fetcher(`/api${path}`, {
    ...rest,
    credentials: "same-origin",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    if (response.ok)
      throw new Error(
        "A resposta do servidor não pôde ser confirmada. Atualize a tela antes de repetir uma alteração.",
      );
    data = {};
  }
  if (!response.ok) {
    const error = new Error(
      data.error ||
        (response.status === 401
          ? "Sua sessão expirou. Entre novamente."
          : "Não foi possível concluir. Tente novamente."),
    );
    error.status = response.status;
    throw error;
  }
  return data;
}

export function notificationPlan(
  items,
  now = Date.now(),
  delivered = new Set(),
) {
  return items
    .filter(
      (item) =>
        item.status === "pending" && item.type !== "memory" && item.dueAt,
    )
    .map((item) => ({
      ...item,
      key: `${item.id}:${item.dueAt}`,
      delay: Date.parse(item.dueAt) - now,
    }))
    .filter(
      (item) =>
        item.delay >= 0 && item.delay <= 2147483647 && !delivered.has(item.key),
    );
}

export function createOnboardingFlow(
  requester,
  idFactory = () => crypto.randomUUID(),
) {
  const captures = new Map();
  return async (profile, context) => {
    await requester("/profile", {
      method: "PATCH",
      body: { name: profile.name, timezone: profile.timezone },
    });
    const text = context.trim();
    let capture;
    if (text) {
      const key = JSON.stringify({ timezone: profile.timezone, text });
      let entry = captures.get(key);
      if (!entry) {
        entry = { requestId: idFactory() };
        captures.set(key, entry);
      }
      if (!entry.response)
        entry.response = await requester("/chat", {
          method: "POST",
          body: { text, requestId: entry.requestId },
        });
      capture = entry.response;
    }
    const result = await requester("/profile", {
      method: "PATCH",
      body: profile,
    });
    return { ...result, capture };
  };
}

export const TYPES = {
  task: "Tarefa",
  event: "Compromisso",
  reminder: "Lembrete",
  memory: "Memória",
};
export function toDateTimeInput(iso, timezone) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (key) => parts.find((p) => p.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function zonedInputToISO(value, timezone) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Data inválida.");
  const target = new Date(`${value}:00Z`);
  if (
    Number.isNaN(target.getTime()) ||
    target.toISOString().slice(0, 16) !== value
  )
    throw new Error("Data inválida.");
  let instant = target.getTime();
  for (let i = 0; i < 4; i++) {
    const rendered = new Date(
      `${toDateTimeInput(new Date(instant).toISOString(), timezone)}:00Z`,
    ).getTime();
    const delta = target.getTime() - rendered;
    if (!delta) {
      // Test nearby UTC offsets too: convergence alone can select one side of an overlap.
      for (let hours = -48; hours <= 48; hours += 6) {
        const sample = instant + hours * 3600000;
        const civil = new Date(
          `${toDateTimeInput(new Date(sample).toISOString(), timezone)}:00Z`,
        ).getTime();
        const candidate = target.getTime() - (civil - sample);
        if (
          candidate !== instant &&
          toDateTimeInput(new Date(candidate).toISOString(), timezone) === value
        )
          throw new Error("Horário ambíguo neste fuso: ele se repete na mudança de horário. Escolha outro horário.");
      }
      return new Date(instant).toISOString();
    }
    instant += delta;
  }
  throw new Error("Horário inválido neste fuso. Escolha outro horário.");
}
export function formatDate(iso, timezone, full = false) {
  if (!iso) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    day: "2-digit",
    month: full ? "long" : "short",
    ...(full ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
