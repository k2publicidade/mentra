import { toDateTimeInput } from './lib.js';

export function dayKey(instant, timezone) {
  return toDateTimeInput(new Date(instant).toISOString(), timezone).slice(0, 10);
}
export function shiftDay(day, offset) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function agendaFor(items, day, timezone, now = Date.now()) {
  const today = dayKey(now, timezone);
  const dated = items.filter(i => i.type !== 'memory' && i.status === 'pending' && i.dueAt);
  return {
    scheduled: dated.filter(i => dayKey(i.dueAt, timezone) === day).sort((a,b) => a.dueAt.localeCompare(b.dueAt)),
    overdue: dated.filter(i => dayKey(i.dueAt, timezone) < today).sort((a,b) => a.dueAt.localeCompare(b.dueAt)),
    undated: items.filter(i => i.type !== 'memory' && i.status === 'pending' && !i.dueAt),
  };
}
export function searchItems(items, filters, timezone, now = Date.now()) {
  const normalize = text => String(text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
  const query = normalize(filters.q).trim();
  const today = dayKey(now, timezone);
  return items.filter(i =>
    (!filters.type || i.type === filters.type) &&
    (!filters.status || i.status === filters.status) &&
    (!filters.focus || (filters.focus === 'priority' ? i.priority && i.status === 'pending' : filters.focus === 'undated' ? !i.dueAt && i.type !== 'memory' && i.status === 'pending' : i.dueAt && i.status === 'pending' && i.type !== 'memory' && dayKey(i.dueAt, timezone) < today)) &&
    normalize(`${i.title} ${i.notes || ''} ${i.source || ''}`).includes(query)
  ).sort((a,b) => filters.sort === 'date'
    ? (a.dueAt || '9999').localeCompare(b.dueAt || '9999') || a.title.localeCompare(b.title, 'pt-BR')
    : filters.sort === 'title' ? a.title.localeCompare(b.title, 'pt-BR')
    : (b.createdAt || '').localeCompare(a.createdAt || ''));
}
