import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  MessageCircle,
  Layers,
  UserRound,
  Leaf,
  RefreshCw,
  X,
  Check,
  Undo2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { apiRequest, notificationPlan, createOnboardingFlow } from "./lib.js";
import {
  Auth,
  Onboarding,
  Today,
  Life,
  Chat,
  Account,
  ItemEditor,
  Brand,
} from "./screens.jsx";

const NAV = [
  { id: "hoje", label: "Hoje", icon: CalendarDays },
  { id: "mentra", label: "Mentra", icon: MessageCircle },
  { id: "vida", label: "Vida", icon: Layers },
  { id: "eu", label: "Eu", icon: UserRound },
];
export default function App() {
  const [boot, setBoot] = useState(true),
    [user, setUser] = useState(null),
    [tab, setTab] = useState(() => typeof window !== 'undefined' && NAV.some(n => n.id === window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'hoje');
  const [lifeFilters, setLifeFilters] = useState({ q: '', type: '', status: '', focus: '', sort: 'recent' });
  const [chatDraft, setChatDraft] = useState('');
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine);
    const history = () => {
      const next = window.location.hash.slice(1);
      if (NAV.some(n => n.id === next)) setTab(next);
      else if (!next) setTab('hoje');
    };
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    window.addEventListener('hashchange', history);
    return () => { window.removeEventListener('online', connection); window.removeEventListener('offline', connection); window.removeEventListener('hashchange', history); };
  }, []);
  useEffect(() => {
    document.title = `${NAV.find(n => n.id === tab)?.label || 'Mentra'} · Mentra Life`;
    window.scrollTo({top: 0, behavior: 'instant'});
  }, [tab]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      document.documentElement.style.setProperty('--app-height', `${viewport?.height || window.innerHeight}px`);
      document.documentElement.classList.toggle('keyboard-open', !!viewport && viewport.height < window.innerHeight * .78 && /INPUT|TEXTAREA/.test(document.activeElement?.tagName || ''));
    };
    resize();
    viewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    window.addEventListener('focusout', resize);
    return () => { viewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize); window.removeEventListener('focusout', resize); document.documentElement.classList.remove('keyboard-open'); };
  }, []);
  const [data, setData] = useState({
    items: [],
    messages: [],
    summary: null,
    integrations: null,
  });
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(null);
  const [editor, setEditor] = useState(undefined),
    [notificationStatus, setNotificationStatus] = useState(""),
    [notificationEnabled, setNotificationEnabled] = useState(false),
    [tick, setTick] = useState(0);
  const main = useRef(null),
    lock = useRef(false),
    request = useRef(null),
    delivered = useRef(new Set()),
    generation = useRef(0);
  const onboardingFlow = useRef(null);
  if (!onboardingFlow.current)
    onboardingFlow.current = createOnboardingFlow(apiRequest);
  const clear = useCallback(() => {
    onboardingFlow.current = createOnboardingFlow(apiRequest);
    generation.current++;
    setUser(null);
    setData({ items: [], messages: [], summary: null, integrations: null });
    setEditor(undefined);
    setToast(null);
    setTab("hoje");
    setChatDraft('');
    setLifeFilters({ q: '', type: '', status: '', focus: '', sort: 'recent' });
    window.history.replaceState(null, '', window.location.pathname);
    setNotificationEnabled(false);
    delivered.current.clear();
    request.current = null;
  }, []);
  const report = useCallback(
    (err) => {
      if (err.status === 401) clear();
      setError(
        err.message ||
          "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
      );
    },
    [clear],
  );
  const refresh = useCallback(async () => {
    const current = generation.current;
    setLoading(true);
    try {
      const [items, messages, summary, integrations] = await Promise.all([
        apiRequest("/items"),
        apiRequest("/messages"),
        apiRequest("/summary"),
        apiRequest("/integrations"),
      ]);
      if (current !== generation.current) return;
      setData({
        items: items.items,
        messages: messages.messages,
        summary,
        integrations,
      });
    } catch (err) {
      if (current === generation.current) report(err);
      throw err;
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [report]);
  useEffect(() => {
    let active = true;
    apiRequest("/auth/me")
      .then(({ user: me }) => {
        if (active) {
          setUser(me);
          refresh().catch(() => {});
        }
      })
      .catch((err) => {
        if (active && err.status !== 401) report(err);
      })
      .finally(() => {
        if (active) setBoot(false);
      });
    return () => {
      active = false;
    };
  }, [refresh, report]);
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, [user?.id]);
  useEffect(() => {
    if (
      !notificationEnabled ||
      !user ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    const timers = notificationPlan(
      data.items,
      Date.now(),
      delivered.current,
    ).map((item) =>
      setTimeout(() => {
        if (
          Notification.permission !== "granted" ||
          delivered.current.has(item.key)
        )
          return;
        try {
          new Notification("Mentra Life · É hora", {
            body: item.title,
            tag: item.key,
          });
          delivered.current.add(item.key);
        } catch {
          setNotificationStatus(
            "O navegador não conseguiu mostrar o aviso. Consulte sua agenda em Hoje.",
          );
        }
      }, item.delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [data.items, notificationEnabled, user?.id, tick]);
  useEffect(() => {
    if (!toast || toast.undoId) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const navigate = useCallback((next) => {
    setTab(next);
    if (window.location.hash !== `#${next}`) window.location.hash = next;
    setError("");
    setToast(null);
    setTimeout(() => main.current?.focus({ preventScroll: true }), 0);
  }, []);
  const operate = async (operation, successText) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await operation();
      if (successText) setToast({ text: successText, undoId: result?.undoId });
      return result || true;
    } catch (err) {
      report(err);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const syncAfterWrite = async () => {
    try {
      await refresh();
    } catch {
      setError(
        "A alteração foi confirmada, mas não foi possível atualizar a tela. Use Atualizar antes de editar novamente.",
      );
    }
  };
  const auth = async (mode, values) => {
    const result = await operate(() =>
      apiRequest(`/auth/${mode}`, { method: "POST", body: values }),
    );
    if (result?.confirmationRequired) return result;
    if (result) {
      generation.current++;
      setUser(result.user);
      setTab("hoje");
      await syncAfterWrite();
    }
  };
  const chat = async (text) => {
    // An uncertain network response can be retried safely with the same account-scoped requestId.
    if (request.current?.text !== text)
      request.current = { text, requestId: crypto.randomUUID() };
    const payload = request.current;
    const result = await operate(() =>
      apiRequest("/chat", { method: "POST", body: payload }),
    );
    if (result) {
      request.current = null;
      setToast({
        text: result.clarification
          ? "Mentra precisa de um detalhe. Responda na conversa."
          : "Pedido processado. Veja a resposta na conversa.",
        undoId: result.undoId,
      });
      await syncAfterWrite();
      return true;
    }
    return false;
  };
  const onboarding = async (profile, context) => {
    const result = await operate(() =>
      onboardingFlow.current(profile, context),
    );
    if (result) {
      setUser(result.user);
      setTab(context.trim() ? "mentra" : "hoje");
      if (result.capture?.undoId)
        setToast({
          text: "Seu primeiro registro foi processado. Veja a resposta na conversa.",
          undoId: result.capture.undoId,
        });
      await syncAfterWrite();
    }
  };
  const saveProfile = async (values) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: values.timezone });
    } catch {
      setError("Informe um fuso horário válido, como America/Sao_Paulo.");
      return;
    }
    const result = await operate(
      () => apiRequest("/profile", { method: "PATCH", body: values }),
      "Preferências salvas.",
    );
    if (result) {
      setUser(result.user);
      await syncAfterWrite();
    }
  };
  const action = async (kind, item, patch) => {
    if (
      kind === "delete" &&
      !window.confirm(
        `Excluir “${item.title}”? Você poderá desfazer esta alteração.`,
      )
    )
      return;
    const result = await operate(
      () =>
        apiRequest(`/items/${encodeURIComponent(item.id)}`, {
          method: kind === "delete" ? "DELETE" : "PATCH",
          ...(kind === "delete" ? {} : { body: patch }),
        }),
      kind === "delete" ? "Registro excluído." : "Registro atualizado.",
    );
    if (result) await syncAfterWrite();
  };
  const saveItem = async (values, item) => {
    // Source is editable for memories. Backend accepts this field in PATCH as required by the UI contract.
    const payload = item?.id
      ? {
          title: values.title,
          notes: values.notes,
          dueAt: values.dueAt,
          priority: values.priority,
          ...(values.source !== undefined ? { source: values.source } : {}),
        }
      : values;
    const result = await operate(
      () =>
        apiRequest(
          item?.id ? `/items/${encodeURIComponent(item.id)}` : "/items",
          { method: item?.id ? "PATCH" : "POST", body: payload },
        ),
      item?.id ? "Registro atualizado." : "Registro salvo.",
    );
    if (result) {
      setEditor(undefined);
      await syncAfterWrite();
    }
  };
  const undo = async () => {
    if (!toast?.undoId) return;
    const result = await operate(
      () =>
        apiRequest(`/undo/${encodeURIComponent(toast.undoId)}`, {
          method: "POST",
          body: {},
        }),
      "Alteração desfeita.",
    );
    if (result) await syncAfterWrite();
  };
  const logout = async () => {
    const result = await operate(() =>
      apiRequest("/auth/logout", { method: "POST", body: {} }),
    );
    if (result) {
      clear();
      setError("");
    }
  };
  const deleteAccount = async (confirmation) => {
    const result = await operate(() =>
      apiRequest("/account", { method: "DELETE", body: { confirmation } }),
    );
    if (result) {
      clear();
      setError("");
      setToast({ text: "Sua conta e seus dados foram excluídos." });
    }
  };
  const notify = async () => {
    if (!("Notification" in window)) {
      setNotificationStatus(
        "Este navegador não oferece notificações. Sua agenda continua disponível em Hoje.",
      );
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationEnabled(permission === "granted");
      setNotificationStatus(
        permission === "granted"
          ? "Avisos ativados enquanto esta página estiver aberta. Não há entrega garantida com a página fechada."
          : permission === "denied"
            ? "Permissão negada. Para ativar, altere a permissão nas configurações do navegador."
            : "Permissão não concedida. Nenhum aviso será enviado.",
      );
    } catch {
      setNotificationStatus(
        "Não foi possível solicitar a permissão. Verifique as configurações do navegador.",
      );
    }
  };
  if (boot)
    return (
      <main className="boot">
        <Brand />
        <p role="status">Abrindo seu espaço…</p>
      </main>
    );
  if (!user)
    return (
      <>
        <Auth onSubmit={auth} busy={busy} error={error} initialRegister={new URLSearchParams(window.location.search).get('cadastro') === '1'} />
        {toast && (
          <div className="toast" role="status">
            <Check size={18} />
            <span>{toast.text}</span>
            <button
              className="icon-button"
              onClick={() => setToast(null)}
              aria-label="Fechar confirmação"
            >
              <X size={17} />
            </button>
          </div>
        )}
      </>
    );
  const common = {
    user,
    ...data,
    busy: busy || loading,
    onEdit: item => { setError(''); setEditor(item); },
    onAction: action,
    onChat: chat,
    onSave: saveProfile,
    onLogout: logout,
    onDelete: deleteAccount,
    onNavigate: navigate,
    onNotify: notify,
    notificationStatus,
    filters: lifeFilters,
    onFilters: setLifeFilters,
    draftText: chatDraft,
    onDraft: setChatDraft,
  };
  if (!user.onboarded)
    return (
      <>
        <Onboarding user={user} onSave={onboarding} busy={busy} />
        {error && (
          <div className="onboard-error" role="alert">
            {error}
          </div>
        )}
      </>
    );
  return (
    <div className={`app-shell ${tab === 'mentra' ? 'is-chat' : ''}`}>
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <aside className="sidebar" inert={editor !== undefined ? true : undefined}>
        <Brand compact />
        <div className="sidebar-rule" />
        <p className="nav-caption">SEU ESPAÇO</p>
        <nav className="main-nav" aria-label="Navegação principal">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={21} />
              <span>{label}</span>
              {id === "mentra" && <span className="nav-spark" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="status-dot" />
            <strong>
              {data.integrations?.ai === "configured"
                ? "IA configurada"
                : "Organização em português"}
            </strong>
            <p>
              {data.integrations?.ai === "configured"
                ? "Provedor no servidor"
                : "Interpretação no servidor"}
            </p>
          </div>
          <button className="sidebar-profile" onClick={() => navigate("eu")}>
            <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
            <span>
              <strong>{user.name}</strong>
              <small>Conta gratuita</small>
            </span>
          </button>
        </div>
      </aside>
      <div className="workspace" inert={editor !== undefined ? true : undefined}>
        <header className="topbar">
          {(busy || loading) && <div className="sync-progress" role="progressbar" aria-label={loading ? 'Atualizando registros' : 'Processando ação'}><span/></div>}
          <div className="breadcrumb">
            Seu espaço <span>/</span>{" "}
            <strong>{NAV.find((n) => n.id === tab)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="topbar-note">
              <span className="status-dot" />{" "}
              {loading ? "Atualizando…" : busy ? "Processando…" : "No seu ritmo"}
            </span>
            <button
              className="icon-button"
              aria-label="Atualizar registros"
              title="Atualizar"
              disabled={busy || loading}
              onClick={() => {
                setError("");
                refresh().catch(() => {});
              }}
            >
              <RefreshCw size={17} className={loading ? "spinning" : ""} />
            </button>
            <span className="avatar small">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>
        <main
          id="main"
          ref={main}
          tabIndex={-1}
          className={`main-content ${tab === "mentra" ? "chat-main" : ""}`}
        >
          <div className="mobile-brand">
            <Brand compact />
          </div>
          {!online && <div className="connection-banner" role="status">Sem conexão. Você pode revisar o que já está na tela; conecte-se para atualizar ou salvar.</div>}
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button
                className="text-button"
                onClick={() => {
                  setError("");
                  refresh().catch(() => {});
                }}
              >
                Tentar novamente
              </button>
              <button
                className="icon-button"
                aria-label="Fechar erro"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div key={tab} className={`screen-stage ${tab === 'mentra' ? 'conversation-stage' : ''}`}>
          {loading && !data.summary ? (
            <div className="loading-panel" role="status">
              <Leaf size={28} />
              <p>Buscando seus registros…</p>
              <div className="loading-skeleton" aria-hidden="true"><span/><span/><span/></div>
            </div>
          ) : tab === "hoje" ? (
            <Today {...common} />
          ) : tab === "vida" ? (
            <Life {...common} />
          ) : tab === "mentra" ? (
            <Chat {...common} />
          ) : (
            <Account key={user.id} {...common} />
          )}
          </div>
        </main>
        <footer className="workspace-footer">
          <span>MENTRA LIFE</span>
          <span>Um passo de cada vez.</span>
        </footer>
      </div>
      {tab !== 'mentra' && <button className="quick-add" aria-label="Adicionar registro" disabled={editor !== undefined || busy} onClick={() => { setError(''); setEditor(null); }}><Plus size={24} /><span>Adicionar</span></button>}
      {editor !== undefined && (
        <ItemEditor
          item={editor}
          user={user}
          busy={busy || loading}
          serverError={error}
          onClose={() => setEditor(undefined)}
          onSubmit={saveItem}
        />
      )}{" "}
      {toast && (
        <div key={toast.undoId || toast.text} className="toast" role="status">
          <Check size={18} />
          <span>{toast.text}</span>
          {toast.undoId && (
            <button className="undo-button" onClick={undo} disabled={busy}>
              <Undo2 size={16} /> Desfazer
            </button>
          )}
          <button
            className="icon-button"
            onClick={() => setToast(null)}
            aria-label="Fechar confirmação"
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
