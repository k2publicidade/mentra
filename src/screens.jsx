import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowRight,
  Check,
  Plus,
  Search,
  Star,
  Pencil,
  Trash2,
  CalendarDays,
  Bell,
  Bookmark,
  ListTodo,
  ShieldCheck,
  Download,
  LogOut,
  ChevronRight,
  X,
  Leaf,
  MessageCircle,
  Circle,
} from "lucide-react";
import { VoiceRecorder } from "./VoiceRecorder.jsx";
import { mergeTranscript } from "./voice.js";
import { TYPES, formatDate, toDateTimeInput, zonedInputToISO } from "./lib.js";
import { agendaFor, dayKey, shiftDay, searchItems } from './ux.js';
import { InstallApp } from './InstallApp.jsx';

export const typeIcons = {
  task: ListTodo,
  event: CalendarDays,
  reminder: Bell,
  memory: Bookmark,
};
export function Brand({ compact = false }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Leaf size={23} />
      </span>
      <span>
        mentra<span className="brand-life"> LIFE</span>
        {!compact && <small>Espaço para o que importa.</small>}
      </span>
    </div>
  );
}
export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-line" />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
export function Field({ label, children, hint }) {
  const id = React.useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) &&
        ["input", "select", "textarea"].includes(child.type)
          ? React.cloneElement(child, {
              id,
              "aria-describedby": hint ? `${id}-hint` : undefined,
            })
          : child,
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function TimezoneField({ value, onChange }) {
  const zones = [
    "America/Sao_Paulo",
    "America/Manaus",
    "America/Belem",
    "America/Fortaleza",
    "America/Recife",
    "America/Bahia",
    "America/Cuiaba",
    "America/Rio_Branco",
    "America/Noronha",
    "Europe/Lisbon",
    "Europe/London",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Tokyo",
    "UTC",
  ];
  return (
    <Field label="Fuso horário" hint="Suas datas e lembretes seguem este fuso.">
      <input
        required
        list="timezones"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      <datalist id="timezones">
        {zones.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
    </Field>
  );
}
export function Auth({ onSubmit, busy, error, initialRegister = false }) {
  const [register, setRegister] = useState(initialRegister);
  const [notice, setNotice] = useState("");
  const [timezone, setTimezone] = useState(
    () =>
      Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
  );
  const submit = async (e) => {
    e.preventDefault();
    setNotice("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const result = await onSubmit(register ? "register" : "login", {
      ...values,
      ...(register ? { timezone } : {}),
    });
    if (result?.confirmationRequired) {
      setRegister(false);
      setNotice(result.message || "Confira seu e-mail para confirmar o cadastro. Depois entre na sua conta.");
    }
  };
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="story-copy">
          <p className="eyebrow">MENOS RUÍDO. MAIS PRESENÇA.</p>
          <h1>
            Uma vida inteira.
            <br />
            Um lugar para
            <br />
            <em>organizar.</em>
          </h1>
          <p>
            Tarefas, compromissos e pequenas coisas que você não quer esquecer.
            Tire da cabeça. Volte para a vida.
          </p>
        </div>
        <div className="story-foot">
          <span className="small-orbit" /> Um espaço seu, no seu ritmo.
        </div>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <p className="eyebrow">SEU ESPAÇO PESSOAL</p>
          <h2>{register ? "Comece com leveza." : "Bom ter você por aqui."}</h2>
          <p className="muted">
            {register
              ? "Crie sua conta e organize o primeiro pensamento."
              : "Entre para continuar de onde parou."}
          </p>
          <div className="segmented" aria-label="Acesso à conta">
            <button
              type="button"
              aria-pressed={!register}
              onClick={() => setRegister(false)}
            >
              Entrar
            </button>
            <button
              type="button"
              aria-pressed={register}
              onClick={() => setRegister(true)}
            >
              Criar conta
            </button>
          </div>
          <form onSubmit={submit}>
            {register && (
              <Field label="Seu nome">
                <input
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Como podemos chamar você?"
                />
              </Field>
            )}
            <Field label="E-mail">
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="voce@exemplo.com"
              />
            </Field>
            <Field
              label="Senha"
              hint={
                register
                  ? "Use pelo menos 10 caracteres. Não compartilhe sua senha."
                  : undefined
              }
            >
              <input
                name="password"
                type="password"
                required
                minLength={register ? 10 : undefined}
                maxLength={256}
                autoComplete={register ? "new-password" : "current-password"}
              />
            </Field>
            {register && (
              <TimezoneField value={timezone} onChange={setTimezone} />
            )}{" "}
            {notice && <p role="status">{notice}</p>}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? "Aguarde…" : register ? "Criar meu espaço" : "Entrar"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="privacy-note">
            <ShieldCheck size={18} />
            <p>
              Seus registros ficam nesta instalação. Integrações externas só
              aparecem quando configuradas.
            </p>
          </div>
        </div>
        <span className="auth-footer">MENTRA LIFE · Um passo de cada vez.</span>
      </section>
    </main>
  );
}
export function Onboarding({ user, onSave, busy }) {
  const [step, setStep] = useState(1);
  const [timezone, setTimezone] = useState(user.timezone);
  const [name, setName] = useState(user.name);
  const [context, setContext] = useState("");
  return (
    <main className="onboarding">
      <Brand />
      <div className="onboard-card">
        <p className="eyebrow">PRIMEIROS PASSOS · {step} DE 2</p>
        <div className="step-track">
          <span />
          <span className={step === 2 ? "active" : ""} />
        </div>
        <h1>
          {step === 1
            ? "Primeiro, o seu ritmo."
            : "O que podemos tirar da sua cabeça?"}
        </h1>
        <p className="muted">
          {step === 1
            ? "Só o essencial para começar. Você pode mudar tudo depois."
            : "Uma tarefa, um compromisso ou um lembrete. Escreva naturalmente; quando faltar algo, vamos perguntar."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 1) {
              try {
                new Intl.DateTimeFormat("pt-BR", { timeZone: timezone });
                setStep(2);
              } catch {
                e.currentTarget
                  .querySelector("input[list]")
                  .setCustomValidity(
                    "Informe um fuso válido, como America/Sao_Paulo.",
                  );
                e.currentTarget.reportValidity();
              }
            } else onSave({ name, timezone, onboarded: true }, context);
          }}
        >
          {step === 1 ? (
            <>
              <Field label="Como quer ser chamado(a)?">
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <TimezoneField
                value={timezone}
                onChange={(value) => {
                  setTimezone(value);
                  document.querySelector("input[list]")?.setCustomValidity("");
                }}
              />
            </>
          ) : (
            <>
              <Field
                label="Seu primeiro registro"
                hint="Exemplo: Me lembra amanhã às 9 de enviar o contrato."
              >
                <textarea
                  rows={4}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  maxLength={2000}
                  placeholder="O que você não quer esquecer?"
                  autoFocus
                />
              </Field>
              <p className="local-note">
                Modo local: interpretação em português, sem um modelo de IA
                externo.
              </p>
            </>
          )}
          <div className="form-actions">
            {step === 2 && (
              <button
                type="button"
                className="ghost"
                onClick={() => setStep(1)}
              >
                Voltar
              </button>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? "Salvando…"
                : step === 1
                  ? "Continuar"
                  : context.trim()
                    ? "Salvar e começar"
                    : "Começar sem registro"}
              <ArrowRight size={17} />
            </button>
          </div>
        </form>
      </div>
      <p className="muted tiny">
        Não precisamos saber tudo sobre você. Apenas o que decidir registrar.
      </p>
    </main>
  );
}
export function ItemRow({ item, user, onAction, onEdit, busy }) {
  const Icon = typeIcons[item.type] || ListTodo;
  return (
    <article
      className={`item-row ${item.status === "completed" ? "completed" : ""}`}
    >
      <button
        className="complete-button"
        aria-label={`${item.status === "completed" ? "Reabrir" : "Concluir"} ${item.title}`}
        disabled={busy}
        onClick={() =>
          onAction("update", item, {
            status: item.status === "completed" ? "pending" : "completed",
          })
        }
      >
        {item.status === "completed" ? (
          <Check size={18} />
        ) : (
          <Circle size={21} />
        )}
      </button>
      <div className="item-content">
        <button className="item-title" onClick={() => onEdit(item)}>
          {item.title}
        </button>
        <div className="item-meta">
          <Icon size={13} />
          <span>{TYPES[item.type]}</span>
          {item.dueAt && (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={item.dueAt}>
                {formatDate(item.dueAt, user.timezone)}
              </time>
            </>
          )}
          {item.status === "completed" && (
            <span className="tag">Concluído</span>
          )}
          {item.status === 'pending' && item.type !== 'memory' && item.dueAt && dayKey(item.dueAt,user.timezone) < dayKey(Date.now(),user.timezone) && <span className="tag overdue-tag">Para revisar</span>}
        </div>
        {item.notes && <p className="item-notes">{item.notes}</p>}
        {item.type === "memory" && (
          <p className="source">Origem: {item.source || "Não informada"}</p>
        )}
      </div>
      <div className="item-actions">
        {item.type !== "memory" && (
          <button
            className={`icon-button ${item.priority ? "is-priority" : ""}`}
            title={item.priority ? "Retirar prioridade" : "Priorizar"}
            aria-label={`${item.priority ? "Retirar prioridade de" : "Priorizar"} ${item.title}`}
            aria-pressed={!!item.priority}
            disabled={busy || item.status === "completed"}
            onClick={() =>
              onAction("update", item, { priority: !item.priority })
            }
          >
            <Star size={18} fill={item.priority ? "currentColor" : "none"} />
          </button>
        )}
        <button
          className="icon-button"
          aria-label={`Editar ${item.title}`}
          title="Editar"
          onClick={() => onEdit(item)}
        >
          <Pencil size={16} />
        </button>
        <button
          className="icon-button danger-icon"
          aria-label={`Excluir ${item.title}`}
          title="Excluir"
          disabled={busy}
          onClick={() => onAction("delete", item)}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}
export function Today(props) {
  const { user, items, summary, onEdit, onNavigate } = props;
  const today = dayKey(Date.now(), user.timezone);
  const [selectedDay, setSelectedDay] = useState(today);
  const [showUndated, setShowUndated] = useState(false);
  const agenda = agendaFor(items, selectedDay, user.timezone);
  const completed = items.filter(i => i.type !== 'memory' && i.status === 'completed' && i.dueAt && dayKey(i.dueAt, user.timezone) === today).length;
  const todayCount = agendaFor(items, today, user.timezone).scheduled.length + completed;
  const priorities = items
    .filter((i) => i.status === "pending" && i.priority)
    .slice(0, 3);
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: user.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return (
    <div className="today-layout">
      <section className="today-main">
        <header className="page-heading">
          <div>
            <p className="eyebrow date-line">{date}</p>
            <h1>Seu dia, com espaço.</h1>
            <p className="muted">
              Olá, {user.name.split(" ")[0]}. Um passo de cada vez.
            </p>
          </div>
          <button className="primary" onClick={() => onEdit(null)}>
            <Plus size={18} /> Novo registro
          </button>
        </header>
        <div className="day-overview" aria-label="Panorama dos registros">
          <div><span>Hoje</span><strong>{agendaFor(items, today, user.timezone).scheduled.length}</strong><small>com data para hoje</small></div>
          <div className={agenda.overdue.length ? 'attention' : ''}><span>Para revisar</span><strong>{agenda.overdue.length}</strong><small>dias anteriores</small></div>
          <div><span>Seu progresso</span><strong>{completed}<em> / {todayCount}</em></strong><small>registros de hoje concluídos</small></div>
        </div>
        <div className="quick-capture" aria-label="Criar por tipo">
          {Object.entries(TYPES).map(([type,label]) => { const Icon = typeIcons[type]; return <button key={type} onClick={() => onEdit({type})}><Icon size={19}/><span>{label}</span><Plus size={14}/></button>; })}
        </div>
        <button className="capture-strip" onClick={() => onNavigate("mentra")}>
          <span className="capture-circle">
            <MessageCircle size={22} />
          </span>
          <span>
            <strong>O que está na sua cabeça?</strong>
            <small>Conte à Mentra. Organize sem interromper o dia.</small>
          </span>
          <ArrowRight size={21} />
        </button>
        <section className="section-block">
          <div className="section-heading">
            <h2>O que importa agora</h2>
            <span className="subtle-counter">
              {priorities.length} de 3 prioridades
            </span>
          </div>
          {priorities.length ? (
            <div className="item-list">
              {priorities.map((item) => (
                <ItemRow key={item.id} {...props} item={item} />
              ))}
            </div>
          ) : (
            <Empty title="Escolha o que merece sua atenção.">
              Marque até três registros com a estrela. O resto pode esperar.
            </Empty>
          )}
        </section>
        <section className="section-block">
          <div className="section-heading">
            <h2>Sua agenda</h2>
            <button className="text-button" onClick={() => onNavigate("vida")}>
              Ver tudo <ChevronRight size={16} />
            </button>
          </div>
          <div className="agenda-controls">
            <button className="icon-button" aria-label="Dia anterior" onClick={() => setSelectedDay(shiftDay(selectedDay, -1))}>‹</button>
            <label><span className="sr-only">Dia da agenda</span><input type="date" value={selectedDay} onChange={e => { if(e.target.value) setSelectedDay(e.target.value); }} /></label>
            <button className="icon-button" aria-label="Próximo dia" onClick={() => setSelectedDay(shiftDay(selectedDay, 1))}>›</button>
            <button className="text-button" onClick={() => setSelectedDay(today)}>Hoje</button>
          </div>
          <div className="week-strip" aria-label="Dias da semana">
            {Array.from({length:7}, (_,offset) => shiftDay(today, offset)).map(day => {
              const when = new Date(`${day}T12:00:00Z`);
              const count = agendaFor(items, day, user.timezone).scheduled.length;
              return <button key={day} aria-pressed={day === selectedDay} aria-label={`${when.toLocaleDateString('pt-BR', {timeZone:'UTC',weekday:'long',day:'numeric',month:'long'})}, ${count} registros`} onClick={() => setSelectedDay(day)}><small>{when.toLocaleDateString('pt-BR',{timeZone:'UTC',weekday:'short'}).replace('.','')}</small><strong>{when.getUTCDate()}</strong><span className={count ? 'day-dot has-items' : 'day-dot'} /></button>;
            })}
          </div>
          <p className="agenda-caption">{selectedDay === today ? 'Hoje' : new Date(`${selectedDay}T12:00:00Z`).toLocaleDateString('pt-BR',{timeZone:'UTC',day:'numeric',month:'long'})} · {agenda.scheduled.length} pendentes</p>
          {agenda.scheduled.length ? (
            <div className="item-list">
              {agenda.scheduled.map((item) => (
                <ItemRow key={item.id} {...props} item={item} />
              ))}
            </div>
          ) : (
            <Empty title="Um dia com espaço livre.">
              Nenhum registro pendente nesta data.
              <button className="text-button" onClick={() => onEdit({type:'event',dueAt:zonedInputToISO(`${selectedDay}T09:00`,user.timezone)})}>Adicionar compromisso <Plus size={16}/></button>
            </Empty>
          )}
        </section>
        {agenda.overdue.length > 0 && <section className="section-block overdue-section"><div className="section-heading"><h2>Vale revisar</h2><span className="tag">{agenda.overdue.length} de dias anteriores</span></div><p className="muted section-description">Conclua o que já fez ou abra o registro para escolher uma nova data.</p><div className="item-list">{agenda.overdue.map(item => <ItemRow key={item.id} {...props} item={item}/>)}</div></section>}
        <section className="section-block"><button className="undated-toggle" aria-expanded={showUndated} onClick={() => setShowUndated(!showUndated)}><ListTodo size={20}/><strong>Sem data, no seu ritmo</strong><span>{agenda.undated.length}</span><ChevronRight size={18} className={showUndated ? 'turned' : ''}/></button>{showUndated && (agenda.undated.length ? <div className="item-list">{agenda.undated.map(item => <ItemRow key={item.id} {...props} item={item}/>)}</div> : <Empty title="Nenhuma pendência sem data.">Adicione uma tarefa quando precisar.</Empty>)}</section>
      </section>
      <aside className="today-aside">
        <div className="summary-panel">
          <p className="eyebrow">SEU PANORAMA</p>
          <div className="summary-title">
            <Leaf size={23} />
            <h2>Uma pausa para olhar.</h2>
          </div>
          <p className="summary-text">
            {summary?.text || "Seu resumo está sendo preparado."}
          </p>
          <div className="summary-footer">
            <span>Derivado dos seus registros</span>
            <span className="status-dot" />
          </div>
        </div>
        <section className="quiet-panel">
          <h3>Não precisa guardar tudo na cabeça.</h3>
          <p>
            Memórias são um lugar para preferências, ideias e detalhes que vale
            a pena reencontrar.
          </p>
          <button
            className="text-button"
            onClick={() =>
              onEdit({
                type: "memory",
                title: "",
                notes: "",
                source: "Informado por mim",
              })
            }
          >
            Guardar uma memória <ArrowRight size={16} />
          </button>
        </section>
        <div className="zone-note">
          <CalendarDays size={16} />
          <span>
            Datas em <strong>{user.timezone}</strong>
          </span>
        </div>
      </aside>
    </div>
  );
}
export function Life(props) {
  const { items, onEdit, user } = props;
  const [localFilters, setLocalFilters] = useState({q:'', type:'', status:'',focus:'',sort:'recent'});
  const filters = props.filters || localFilters;
  const {q,type,status,focus,sort} = filters;
  const change = patch => (props.onFilters || setLocalFilters)(current => ({...current,...patch}));
  const setQ = q => change({q}), setType = type => change({type}), setStatus = status => change({status});
  const reset = () => change({q:'',type:'',status:'',focus:'',sort:'recent'});
  const visible = searchItems(items, filters, user.timezone);
  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">UM LUGAR PARA REENCONTRAR</p>
          <h1>Sua vida, organizada.</h1>
          <p className="muted">
            Tudo o que você decidiu guardar. Nada além disso.
          </p>
        </div>
        <button className="primary" onClick={() => onEdit(null)}>
          <Plus size={18} /> Novo registro
        </button>
      </header>
      <div className="life-tools">
        <label className="search-box">
          <Search size={19} />
          <input
            aria-label="Buscar registros"
            placeholder="Buscar na sua vida…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              className="icon-button"
              aria-label="Limpar busca"
              onClick={() => setQ("")}
            >
              <X size={16} />
            </button>
          )}
        </label>
        <label className="status-select">
          <span className="sr-only">Filtrar por status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="pending">Pendentes</option>
            <option value="completed">Concluídos</option>
          </select>
        </label>
      </div>
      <div className="focus-filters" aria-label="Atalhos de organização">
        {[["", "Todos"], ["priority", "Prioridades"], ["overdue", "Para revisar"], ["undated", "Sem data"]].map(([value,label]) => <button key={value} aria-pressed={focus === value} onClick={() => change({focus:value})}>{label}</button>)}
      </div>
      <div className="filter-tabs" aria-label="Filtrar por tipo">
        {[["", "Tudo"], ...Object.entries(TYPES)].map(([value, label]) => {
          const Icon = typeIcons[value];
          return (
            <button
              key={value}
              aria-pressed={type === value}
              onClick={() => setType(value)}
            >
              {Icon && <Icon size={16} />} {label}
            </button>
          );
        })}
      </div>
      <div className="results-heading">
        <span>
          {visible.length} {visible.length === 1 ? "registro" : "registros"}
        </span>
        <label className="sort-control"><span>Ordenar</span><select aria-label="Ordenar registros" value={sort} onChange={e => change({sort:e.target.value})}><option value="recent">Mais recentes</option><option value="date">Data mais próxima</option><option value="title">Título A–Z</option></select></label>
        {(q || type || status || focus) && <button className="text-button" onClick={reset}>Limpar filtros</button>}
      </div>
      {visible.length ? (
        <div className="item-list life-list">
          {visible.map((item) => (
            <ItemRow key={item.id} {...props} item={item} />
          ))}
        </div>
      ) : (
        <Empty
          title={
            items.length
              ? "Nenhum registro encontrado."
              : "Deixe sua cabeça mais leve."
          }
        >
          {items.length
            ? "Tente outra busca ou outro filtro."
            : "Adicione um registro ou converse com a Mentra para começar."}
          <br />
          {items.length ? <button className="ghost" onClick={reset}>Limpar busca e filtros</button> : <button className="primary" onClick={() => onEdit(null)}><Plus size={18}/>Criar primeiro registro</button>}
        </Empty>
      )}
    </section>
  );
}
export function Chat({
  user,
  messages,
  integrations,
  onChat,
  busy,
  onNavigate,
  draftText,
  onDraft,
}) {
  const [localText, setLocalText] = useState("");
  const text = draftText ?? localText;
  const setText = onDraft || setLocalText;
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceLocked, setVoiceLocked] = useState(false);
  const voiceLock = useRef(false);
  const draft = useRef(text);
  draft.current = text;
  const input = useRef(null);
  const end = useRef(null);
  useEffect(() => {
    if (messages.length)
      end.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [messages.length]);
  const receiveTranscript = (transcript) => {
    const merged = mergeTranscript(draft.current, transcript);
    if (merged === null) return false;
    draft.current = merged;
    setText(merged);
    input.current?.focus();
    return true;
  };
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy || voiceLock.current) return;
    const sent = text;
    const success = await onChat(sent);
    if (success) setText("");
    input.current?.focus();
  };
  const suggestions = [
    "O que tenho hoje?",
    "Minhas tarefas",
    "Minhas memórias",
  ];
  return (
    <section className="chat-screen">
      <header className="page-heading">
        <div>
          <p className="eyebrow">UMA CONVERSA. MENOS COISAS NA CABEÇA.</p>
          <h1>Conte à Mentra.</h1>
          <p className="muted">Capture, pergunte, ajuste. No seu ritmo.</p>
        </div>
        <span className="mode-badge">
          <span className="status-dot" />
          {integrations?.ai === "configured"
            ? "IA configurada no servidor"
            : "Interpretação em português"}
        </span>
      </header>
      <div className="conversation-panel">
        <details className="chat-disclosure"><summary><ShieldCheck size={16}/> Como a Mentra organiza suas mensagens</summary>
          <ShieldCheck size={16} />
          <span>
            {integrations?.ai === "configured"
              ? "Um provedor de IA está configurado. Solicitações podem usar processamento externo."
              : "Interpretação local em português para mensagens. A transcrição de áudio opcional usa processamento externo, com sua autorização. Se faltar um detalhe, vamos perguntar."}
          </span>
        </details>
        <div
          className="messages"
          role="log"
          aria-label="Conversa com a Mentra"
          aria-live="polite"
        >
          {messages.length ? (
            messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                <div className="message-avatar">
                  {message.role === "assistant" ? (
                    <Leaf size={18} />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="message-body">
                  <div className="message-label">
                    {message.role === "assistant" ? "Mentra" : "Você"}
                    <time dateTime={message.createdAt}>
                      {formatDate(message.createdAt, user.timezone)}
                    </time>
                  </div>
                  <p>{message.content}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="chat-welcome">
              <span className="welcome-mark">
                <Leaf size={32} />
              </span>
              <h2>Comece com o que está aí.</h2>
              <p>
                Um compromisso, uma pendência, uma ideia.
                <br />
                Não precisa estar organizado para contar.
              </p>
              <div className="example-prompt">
                <span>Você pode dizer</span>
                <p>“Tenho dentista quinta às 10 e preciso levar os exames.”</p>
              </div>
              <button
                className="text-button"
                onClick={() => onNavigate("vida")}
              >
                Prefere preencher? Abra seus registros <ArrowRight size={16} />
              </button>
            </div>
          )}
          {busy && (
            <p className="processing" role="status">
              Mentra está processando seu pedido…
            </p>
          )}
          <div ref={end} />
        </div>
        <div className="composer-area">
          <div className="suggestions">
            {suggestions.map((s) => (
              <button
                disabled={busy}
                key={s}
                onClick={() => {
                  setText(s);
                  input.current?.focus();
                }}
              >
                {s}
                <ArrowUp size={13} />
              </button>
            ))}
          </div>
          <form className="composer" onSubmit={send}>
            <textarea
              ref={input}
              aria-label="Mensagem para a Mentra"
              placeholder="Tire da cabeça. Escreva aqui…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={2000}
              disabled={busy}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send(e);
                }
              }}
            />
            <div className="composer-buttons">
              <button
                type="submit"
                className="send-button"
                disabled={busy || voiceLocked || !text.trim()}
                aria-label="Enviar mensagem"
              >
                <ArrowUp size={21} />
                <span>Enviar</span>
              </button>
            </div>
          </form>
          <button type="button" className="voice-toggle text-button" aria-expanded={voiceOpen} disabled={voiceLocked} onClick={() => setVoiceOpen(!voiceOpen)}><MessageCircle size={16}/>{voiceOpen ? 'Fechar opções de áudio' : 'Usar áudio'}</button>
          {voiceOpen && <VoiceRecorder busy={busy} onTranscript={receiveTranscript} onLockedChange={(locked) => { voiceLock.current = locked; setVoiceLocked(locked); }} />}
          <div className="composer-note">
            <span>Revise o texto antes de enviar.</span>
            <span>Enter envia · Shift + Enter quebra linha</span>
          </div>
        </div>
      </div>
    </section>
  );
}
export function Account({
  user,
  integrations,
  onSave,
  onLogout,
  onDelete,
  onNotify,
  notificationStatus,
  busy,
}) {
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone);
  const [preferences, setPreferences] = useState({
    morningSummary: false,
    eveningSummary: false,
    proactivity: "balanced",
    ...user.preferences,
  });
  const [confirmation, setConfirmation] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const preference = (key, value) =>
    setPreferences((p) => ({ ...p, [key]: value }));
  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">SEU ESPAÇO, SUAS ESCOLHAS</p>
          <h1>Do seu jeito.</h1>
          <p className="muted">Preferências, privacidade e transparência.</p>
        </div>
        <button className="ghost" disabled={busy} onClick={onLogout}>
          <LogOut size={17} /> Sair
        </button>
      </header>
      <div className="account-grid">
        <div>
          <section className="settings-panel">
            <div className="settings-heading">
              <h2>Seu perfil</h2>
              <span className="tag">Conta pessoal</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSave({ name, timezone, preferences });
              }}
            >
              <Field label="Nome">
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="E-mail">
                <input readOnly value={user.email} type="email" />
                <small>
                  O e-mail identifica sua conta e não pode ser alterado aqui.
                </small>
              </Field>
              <TimezoneField value={timezone} onChange={setTimezone} />
              <h3 className="form-subheading">Seu ritmo</h3>
              <label className="switch-row">
                <span>
                  <strong>Resumo da manhã</strong>
                  <small>Preferência registrada para o seu dia.</small>
                </span>
                <input
                  type="checkbox"
                  checked={preferences.morningSummary}
                  onChange={(e) =>
                    preference("morningSummary", e.target.checked)
                  }
                />
              </label>
              <label className="switch-row">
                <span>
                  <strong>Resumo da noite</strong>
                  <small>Preferência registrada para encerrar o dia.</small>
                </span>
                <input
                  type="checkbox"
                  checked={preferences.eveningSummary}
                  onChange={(e) =>
                    preference("eveningSummary", e.target.checked)
                  }
                />
              </label>
              <Field label="Proatividade">
                <select
                  value={preferences.proactivity}
                  onChange={(e) => preference("proactivity", e.target.value)}
                >
                  <option value="quiet">Discreta</option>
                  <option value="balanced">Equilibrada</option>
                  <option value="active">Mais presente</option>
                </select>
              </Field>
              <p className="tiny muted">
                Preferências são salvas. O resumo atual está em Hoje; não há
                envio automático pela manhã ou à noite nesta versão.
              </p>
              <button className="primary" disabled={busy}>
                {busy ? "Salvando…" : "Salvar preferências"}
                <Check size={17} />
              </button>
            </form>
          </section>
          <section className="settings-panel">
            <h2>Notificações no navegador</h2>
            <p>
              Receba avisos dos registros com data enquanto esta página estiver
              aberta. Com a página fechada ou suspensa, não há garantia de
              entrega.
            </p>
            <button className="ghost" onClick={onNotify} disabled={busy}>
              <Bell size={17} /> Ativar avisos neste navegador
            </button>
            <p className="tiny muted" role="status">
              {notificationStatus ||
                "A permissão só será solicitada quando você ativar."}
            </p>
          </section>
        </div>
        <div>
          <InstallApp />
          <section className="plan-panel">
            <div className="settings-heading">
              <h2>Seu plano</h2>
              <span className="tag">Gratuito</span>
            </div>
            <p>O essencial para organizar sua vida.</p>
            <div className="plan-note">
              <strong>Premium, ainda não disponível.</strong>
              <span>
                Não há cobrança, pagamento ou ativação de plano nesta
                instalação.
              </span>
            </div>
          </section>
          <section className="settings-panel">
            <h2>Conexões, sem surpresas.</h2>
            <div className="integration-row">
              <CalendarDays size={19} />
              <div>
                <strong>Calendário</strong>
                <small>
                  Somente exportação. Não sincroniza agendas externas.
                </small>
              </div>
              <span className="tag">Exportação</span>
            </div>
            <a className="text-button" href="/api/calendar.ics" download>
              <Download size={16} /> Exportar calendário (.ics)
            </a>
            <div className="integration-row">
              <MessageCircle size={19} />
              <div>
                <strong>WhatsApp</strong>
                <small>
                  {integrations?.whatsapp === "unconfigured"
                    ? "Não configurado. Nenhuma mensagem é enviada."
                    : "Status não confirmado."}
                </small>
              </div>
            </div>
            <div className="integration-row">
              <Leaf size={19} />
              <div>
                <strong>Inteligência artificial</strong>
                <small>
                  {integrations?.ai === "configured"
                    ? "Provedor configurado no servidor. Processamento externo pode ser usado."
                    : "Modo local. Sem provedor de IA externo."}
                </small>
              </div>
            </div>
            <p className="tiny muted">
              Os estados refletem a configuração do servidor, não uma conexão
              simulada.
            </p>
          </section>
          <section className="settings-panel">
            <div className="settings-heading">
              <h2>Seus dados são seus.</h2>
              <ShieldCheck size={20} />
            </div>
            <p>
              Sua conta, conversas, memórias e registros ficam nesta instalação.
              Você pode baixar uma cópia ou excluir tudo.
            </p>
            <a className="ghost" href="/api/export" download>
              <Download size={17} /> Exportar meus dados (.json)
            </a>
            <hr />
            <button
              className="text-button danger"
              onClick={() => setDeleteOpen(!deleteOpen)}
            >
              Excluir conta e todos os dados
            </button>
            {deleteOpen && (
              <form
                className="delete-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  onDelete(confirmation);
                }}
              >
                <p>
                  Esta ação é definitiva e encerra todas as sessões. Conversas,
                  registros, memórias e histórico serão apagados.
                </p>
                <Field label="Digite EXCLUIR para confirmar">
                  <input
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    autoComplete="off"
                    required
                    pattern="EXCLUIR"
                  />
                </Field>
                <div className="form-actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setDeleteOpen(false);
                      setConfirmation("");
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="danger-button"
                    disabled={busy || confirmation !== "EXCLUIR"}
                  >
                    Excluir definitivamente
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
export function ItemEditor({ item, user, busy, onClose, onSubmit, serverError }) {
  const dialog = useRef(null);
  const dirty = useRef(false);
  const close = () => {
    if (busy) return;
    if (!dirty.current || window.confirm('Descartar as alterações deste registro?')) onClose();
  };
  const opener = useRef(
    typeof document !== "undefined" ? document.activeElement : null,
  );
  const [type, setType] = useState(item?.type || "task");
  const [date, setDate] = useState(toDateTimeInput(item?.dueAt, user.timezone));
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.querySelector('input[name="title"]')?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
      opener.current?.focus();
    };
  }, []);
  const keyboard = (e) => {
    if (e.key === "Escape" && !busy) close();
    if (e.key === "Tab") {
      const focusables = [
        ...dialog.current.querySelectorAll(
          "button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled])",
        ),
      ];
      const first = focusables[0],
        last = focusables.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  const submit = (e) => {
    e.preventDefault();
    setError("");
    try {
      const values = Object.fromEntries(new FormData(e.currentTarget));
      onSubmit(
        {
          ...values,
          type,
          dueAt:
            type === "memory" ? null : zonedInputToISO(date, user.timezone),
          priority: e.currentTarget.elements.priority?.checked || false,
        },
        item,
      );
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <section
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        onKeyDown={keyboard}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">UM POUCO MAIS DE CLAREZA</p>
            <h2 id="editor-title">
              {item?.id ? "Editar registro" : "Novo registro"}
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Fechar formulário"
            disabled={busy}
            onClick={close}
          >
            <X size={22} />
          </button>
        </div>
        <form onSubmit={submit} onChange={() => { dirty.current = true; }}>
          <Field label="Tipo">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={!!item?.id}
            >
              {Object.entries(TYPES).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Título">
            <input
              required
              name="title"
              maxLength={300}
              defaultValue={item?.title || ""}
              placeholder="O que você quer registrar?"
            />
          </Field>
          <Field label={type === "memory" ? "Detalhes da memória" : "Notas"}>
            <textarea
              name="notes"
              rows={3}
              maxLength={5000}
              defaultValue={item?.notes || ""}
              placeholder="Detalhes, contexto ou preparação…"
            />
          </Field>
          {type === "memory" ? (
            <Field
              label="Origem da memória"
              hint="Guarde como você soube ou decidiu esta informação."
            >
              <input
                required
                name="source"
                maxLength={500}
                defaultValue={item?.source || "Informado por mim"}
              />
            </Field>
          ) : (
            <>
              <Field
                label="Data e horário (opcional)"
                hint={`Interpretado em ${user.timezone}. Sem data, permanece na sua lista.`}
              >
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <div className="date-shortcuts" aria-label="Atalhos de data">
                {[[0,'Hoje'],[1,'Amanhã'],[7,'Em uma semana']].map(([offset,label]) => <button className="ghost" type="button" key={label} onClick={() => { dirty.current = true; setDate(`${shiftDay(dayKey(Date.now(),user.timezone),offset)}T${date.slice(11) || '09:00'}`); }}>{label}</button>)}
                <button type="button" className="text-button" onClick={() => { dirty.current = true; setDate(''); }}>Sem data</button>
              </div>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  name="priority"
                  defaultChecked={!!item?.priority}
                />{" "}
                Marcar como prioridade (até 3 pendentes)
              </label>
            </>
          )}
          {(error || serverError) && (
            <p role="alert" className="form-error">
              {error || serverError}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="ghost"
              disabled={busy}
              onClick={close}
            >
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Salvando…" : "Salvar registro"}
              <Check size={17} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
