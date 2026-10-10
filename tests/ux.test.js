import test from 'node:test';
import assert from 'node:assert/strict';
import { agendaFor, dayKey, shiftDay, searchItems } from '../src/ux.js';

const zone = 'America/Sao_Paulo';
const now = Date.parse('2026-10-10T02:00:00Z'); // still October 9 in the account timezone
const items = [
  {id:'old',title:'Revisão do café',type:'task',status:'pending',dueAt:'2026-10-08T15:00:00Z',createdAt:'2026-10-01',priority:true},
  {id:'today',title:'Dentista',type:'event',status:'pending',dueAt:'2026-10-10T01:00:00Z',createdAt:'2026-10-02'},
  {id:'future',title:'Consulta',type:'reminder',status:'pending',dueAt:'2026-10-10T15:00:00Z',createdAt:'2026-10-03'},
  {id:'done',title:'Concluída',type:'task',status:'completed',dueAt:'2026-10-08T15:00:00Z'},
  {id:'undated',title:'Ler',type:'task',status:'pending',dueAt:null},
  {id:'memory',title:'Café preferido',type:'memory',status:'pending',dueAt:null},
];
test('agenda separates account-local days, overdue records and undated tasks without memories or completed items', () => {
  assert.equal(dayKey(now,zone),'2026-10-09');
  const agenda = agendaFor(items,'2026-10-09',zone,now);
  assert.deepEqual(agenda.scheduled.map(i=>i.id),['today']);
  assert.deepEqual(agenda.overdue.map(i=>i.id),['old']);
  assert.deepEqual(agenda.undated.map(i=>i.id),['undated']);
  assert.deepEqual(agendaFor(items,'2026-10-10',zone,now).scheduled.map(i=>i.id),['future']);
});
test('calendar day shifts handle month/year boundaries without a timezone offset', () => {
  assert.equal(shiftDay('2026-12-31',1),'2027-01-01');
  assert.equal(shiftDay('2026-03-01',-1),'2026-02-28');
});
test('organization combines accent-insensitive queries, status/type/focus filters and stable sorting', () => {
  assert.deepEqual(searchItems(items,{q:'cafe',focus:'priority'},zone,now).map(i=>i.id),['old']);
  assert.deepEqual(searchItems(items,{focus:'overdue'},zone,now).map(i=>i.id),['old']);
  assert.deepEqual(searchItems(items,{focus:'undated'},zone,now).map(i=>i.id),['undated']);
  assert.deepEqual(searchItems(items,{q:'cafe',type:'memory'},zone,now).map(i=>i.id),['memory']);
  assert.deepEqual(searchItems(items,{status:'pending',type:'event'},zone,now).map(i=>i.id),['today']);
  const sorted = searchItems(items,{status:'pending',type:'task',sort:'date'},zone,now);
  assert.deepEqual(sorted.map(i=>i.id),['old','undated']);
  assert.equal(items[0].id,'old');
});
