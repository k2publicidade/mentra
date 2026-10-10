import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const migration = new URL('../supabase/migrations/202610090001_mentra_core.sql', import.meta.url);
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
async function setup(t) {
 const db=new PGlite(); t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb NOT NULL DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
 GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;`);
 let sql;try{sql=await readFile(migration,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;sql='';}
 await db.exec(sql);
 return db;
}
async function as(db,role,uid,sql) {
 await db.exec(`SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub','${uid||''}',false)`);
 try{return await db.query(sql);}finally{await db.exec('RESET ROLE');}
}
async function users(db){await db.exec(`INSERT INTO auth.users(id) VALUES('${A}'),('${B}')`);}
const count=async(db,table)=>(await db.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n;

test('auth signup creates validated default profile without writable plan or credentials',async t=>{
 const db=await setup(t);await users(db);
 const p=(await db.query(`SELECT * FROM public.profiles WHERE id='${A}'`)).rows[0];
 assert.equal(p.name,'Pessoa');assert.equal(p.timezone,'America/Sao_Paulo');assert.equal(p.onboarded,false);
 assert.equal(p.morning_summary,false);assert.equal(p.evening_summary,false);assert.equal(p.proactivity,'balanced');
 assert.ok(p.created_at instanceof Date);assert.ok(p.updated_at instanceof Date);assert.equal('plan' in p,false);
 await assert.rejects(db.exec(`UPDATE public.profiles SET timezone='Mars/Invalid' WHERE id='${A}'`),/timezone/i);
 await assert.rejects(db.exec(`UPDATE public.profiles SET name=' ' WHERE id='${A}'`),/check constraint/i);
 await assert.rejects(db.exec(`UPDATE public.profiles SET proactivity='' WHERE id='${A}'`),/check constraint/i);
});

test('items normalize existing fields with database validation of lengths, types and instants',async t=>{
 const db=await setup(t);await users(db);
 const item=(await db.query(`INSERT INTO public.items(user_id,type,title,due_at) VALUES('${A}','task','Real task','2026-10-09T10:00:00-03:00') RETURNING *`)).rows[0];
 assert.equal(item.status,'pending');assert.equal(item.priority,false);assert.equal(item.source,'manual');assert.equal(item.notes,'');
 assert.equal(item.due_at.toISOString(),'2026-10-09T13:00:00.000Z');assert.ok(item.created_at instanceof Date);
 for(const set of ["type='unknown'","status='unknown'","title=' '","title=repeat('a',301)","notes=repeat('a',10001)","source=''","source=repeat('a',2001)","due_at='infinity'"]) {
  await assert.rejects(db.exec(`UPDATE public.items SET ${set} WHERE id='${item.id}'`),e=>e.code==='23514');
 }
 await assert.rejects(db.exec(`UPDATE public.items SET due_at='not-a-date' WHERE id='${item.id}'`),/timestamp/i);
});

test('RLS isolates profiles and items and denies anonymous access',async t=>{
 const db=await setup(t);await users(db);
 await db.exec(`INSERT INTO public.items(user_id,type,title) VALUES('${A}','task','A'),('${B}','memory','B')`);
 assert.deepEqual((await as(db,'authenticated',A,'SELECT title FROM public.items')).rows.map(r=>r.title),['A']);
 assert.equal((await as(db,'authenticated',A,'SELECT id FROM public.profiles')).rows.length,1);
 assert.equal((await as(db,'authenticated',A,`UPDATE public.items SET title='stolen' WHERE user_id='${B}' RETURNING id`)).rows.length,0);
 assert.equal((await as(db,'authenticated',A,`DELETE FROM public.items WHERE user_id='${B}' RETURNING id`)).rows.length,0);
 await assert.rejects(as(db,'authenticated',A,`INSERT INTO public.items(user_id,type,title) VALUES('${B}','task','forged')`),/row-level security/i);
 await assert.rejects(as(db,'anon',null,'SELECT * FROM public.items'),/permission denied/i);
 await assert.rejects(as(db,'anon',null,'SELECT * FROM public.profiles'),/permission denied/i);
 assert.equal((await as(db,'authenticated',null,'SELECT * FROM public.items')).rows.length,0);
 await as(db,'authenticated',A,`UPDATE public.profiles SET name='Meu nome' WHERE id='${A}'`);
 await assert.rejects(as(db,'authenticated',A,`UPDATE public.profiles SET created_at=now() WHERE id='${A}'`),/permission denied/i);
 const own=(await as(db,'authenticated',A,`INSERT INTO public.items(user_id,type,title) VALUES('${A}','task','Own') RETURNING *`)).rows[0];
 await assert.rejects(as(db,'authenticated',A,`UPDATE public.items SET user_id='${B}' WHERE id='${own.id}'`),/immutable/i);
 await assert.rejects(as(db,'authenticated',A,`UPDATE public.items SET type='event' WHERE id='${own.id}'`),/immutable/i);
});

test('server-managed history is owner-readable but cannot be forged and cascades on account removal',async t=>{
 const db=await setup(t);await users(db);
 const inserts={
  messages:u=>`INSERT INTO public.messages(user_id,role,content) VALUES('${u}','assistant','Saved')`,
  undo_actions:u=>`INSERT INTO public.undo_actions(user_id,changes) VALUES('${u}','[{"before":null,"after":{"id":"example"}}]')`,
  chat_requests:u=>`INSERT INTO public.chat_requests(user_id,request_id,input,response) VALUES('${u}','request-1','hello','{}')`,
  conversations:u=>`INSERT INTO public.conversations(user_id,state) VALUES('${u}','{}')`
 };
 for(const [table,insert] of Object.entries(inserts)){
  await as(db,'service_role',null,insert(A));await as(db,'service_role',null,insert(B));
  assert.equal((await as(db,'authenticated',A,`SELECT * FROM public.${table}`)).rows.length,1);
  await assert.rejects(as(db,'authenticated',A,insert(A)),/permission denied/i);
  await assert.rejects(as(db,'anon',null,`SELECT * FROM public.${table}`),/permission denied/i);
 }
 await assert.rejects(as(db,'service_role',null,inserts.chat_requests(A)),/duplicate key/i);
 await assert.rejects(as(db,'service_role',null,`INSERT INTO public.messages(user_id,role,content) VALUES('${A}','admin','Forged')`),/check constraint/i);
 await assert.rejects(as(db,'service_role',null,`INSERT INTO public.undo_actions(user_id,changes) VALUES('${A}','{}')`),/check constraint/i);
 await db.exec(`INSERT INTO public.items(user_id,type,title) VALUES('${A}','task','delete me'),('${B}','task','keep me'); DELETE FROM auth.users WHERE id='${A}'`);
 for(const table of ['profiles','items',...Object.keys(inserts)])assert.equal(await count(db,table),1);
 const rls=(await db.query(`SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'`)).rows;
 assert.equal(rls.length,6);assert.ok(rls.every(t=>t.relrowsecurity));
 const callable=(await db.query(`SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND (has_function_privilege('anon',oid,'EXECUTE') OR has_function_privilege('authenticated',oid,'EXECUTE'))`)).rows;
 assert.deepEqual(callable,[]);
});

test('only three pending priorities fit and completing one frees its unique slot',async t=>{
 const db=await setup(t);await users(db);
 for(let n=0;n<3;n++)await as(db,'authenticated',A,`INSERT INTO public.items(user_id,type,title,priority) VALUES('${A}','task','Priority ${n}',true)`);
 await assert.rejects(as(db,'authenticated',A,`INSERT INTO public.items(user_id,type,title,priority) VALUES('${A}','task','Fourth',true)`),/priorit/i);
 const rows=(await db.query(`SELECT * FROM public.items WHERE user_id='${A}' ORDER BY title`)).rows;
 assert.equal(new Set(rows.map(r=>r.priority_slot)).size,3);
 await as(db,'authenticated',A,`UPDATE public.items SET status='completed' WHERE id='${rows[0].id}'`);
 await as(db,'authenticated',A,`INSERT INTO public.items(user_id,type,title,priority) VALUES('${A}','task','Replacement',true)`);
 await assert.rejects(as(db,'authenticated',A,`UPDATE public.items SET status='pending' WHERE id='${rows[0].id}'`),/priorit/i);
 await as(db,'authenticated',B,`INSERT INTO public.items(user_id,type,title,priority) VALUES('${B}','task','Other user',true)`);
 const checks=(await db.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='public.items'::regclass AND contype='u'`)).rows[0];
 assert.equal(checks.n,1); // Unique (user_id,slot) is the race-proof hard limit.
});

test('existing Auth accounts get profiles and timestamps update without transferring ownership',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 INSERT INTO auth.users VALUES('${A}','{"name":"Antes","timezone":"America/Sao_Paulo"}');`);
 await db.exec(await readFile(migration,'utf8'));
 assert.equal((await db.query(`SELECT name FROM public.profiles WHERE id='${A}'`)).rows[0].name,'Antes');
 const before=(await db.query(`INSERT INTO public.items(user_id,type,title,created_at,updated_at) VALUES('${A}','task','Stamp','2000-01-01','2000-01-01') RETURNING *`)).rows[0];
 assert.notEqual(before.created_at.toISOString(),'2000-01-01T00:00:00.000Z');
 const after=(await db.query(`UPDATE public.items SET title='New',created_at='2000-01-01',updated_at='2000-01-01' WHERE id='${before.id}' RETURNING *`)).rows[0];
 assert.equal(after.created_at.toISOString(),before.created_at.toISOString());
 assert.ok(after.updated_at>=before.updated_at);
 await assert.rejects(db.exec(await readFile(migration,'utf8')),/already exists/i);
 await db.exec('ROLLBACK');assert.equal(await count(db,'items'),1);
});
