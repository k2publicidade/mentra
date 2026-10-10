import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const uid='11111111-1111-4111-8111-111111111111';
async function harness(t,authOverrides={},queryHook=async()=>{}){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;`);
 await db.exec(await readFile(new URL('../supabase/migrations/202610090001_mentra_core.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/202610100001_mentra_server_undo.sql',import.meta.url),'utf8'));
 await db.query('INSERT INTO auth.users(id) VALUES($1)',[uid]);
 const {createOnlineApp}=await import('../server/online-app.js');
 const pool={connect:async()=>({query:async(...args)=>{await queryHook(db,...args);return db.query(...args);},release(){}})};
 const auth={user:async token=>token==='valid'?{id:uid,email:'ana@example.com'}:null,login:async()=>({access_token:'valid',refresh_token:'refresh',expires_in:3600}),signup:async()=>({user:{id:uid},session:null}),logout:async()=>{},deleteUser:async()=>db.query('DELETE FROM auth.users WHERE id=$1',[uid])};
 const app=createOnlineApp({pool,auth:{...auth,...authOverrides},sessionSecret:'a'.repeat(64),origin:'http://localhost',secureCookies:false});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 let cookie='';const request=async(path,method='GET',body,headers={})=>{const res=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return {status:res.status,body:res.headers.get('content-type')?.includes('application/json')?await res.json():await res.text(),headers:res.headers};};
 return {request,db};
}
test('online login validates identity and item creation persists normalized data with undo atomically',async t=>{
 const {request,db}=await harness(t);assert.equal((await request('/items')).status,401);
 const login=await request('/auth/login','POST',{email:'ana@example.com',password:'long-password'});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.ok(!login.headers.get('set-cookie').includes('valid'));
 const created=await request('/items','POST',{type:'task',title:'Real online task'});assert.equal(created.status,201);assert.equal(created.body.item.title,'Real online task');assert.ok(created.body.undoId);
 assert.equal((await db.query('SELECT title FROM items')).rows[0].title,'Real online task');assert.equal((await db.query('SELECT changes FROM undo_actions')).rows.length,1);
});
test('online CRUD undo detects conflicts, ownership and rolls back priority overflow',async t=>{
 const {request,db}=await harness(t);await request('/auth/login','POST',{email:'ana@example.com',password:'long-password'});
 const first=await request('/items','POST',{type:'task',title:'Original',priority:true});
 assert.equal((await request('/items')).body.items.length,1);
 const edited=await request('/items/'+first.body.item.id,'PATCH',{title:'Edited'});assert.equal(edited.body.item.title,'Edited');
 assert.equal((await request('/undo/'+first.body.undoId,'POST',{})).status,409);
 assert.equal((await request('/undo/'+edited.body.undoId,'POST',{})).status,200);
 assert.equal((await request('/undo/'+edited.body.undoId,'POST',{})).status,409);
 assert.equal((await request('/items')).body.items[0].title,'Original');
 const deleted=await request('/items/'+first.body.item.id,'DELETE');assert.equal(deleted.status,200);
 assert.equal((await request('/undo/'+deleted.body.undoId,'POST',{})).status,200);
 for(let n=0;n<2;n++)assert.equal((await request('/items','POST',{type:'task',title:'P'+n,priority:true})).status,201);
 const before=(await db.query('SELECT count(*)::int n FROM undo_actions')).rows[0].n;
 assert.equal((await request('/items','POST',{type:'task',title:'Overflow',priority:true})).status,409);
 assert.equal((await db.query('SELECT count(*)::int n FROM undo_actions')).rows[0].n,before);
 assert.equal((await request('/items','POST',{type:'event',title:'Impossible',dueAt:'2026-02-31T10:00:00Z'})).status,400);
 assert.equal((await request('/items/22222222-2222-4222-8222-222222222222','PATCH',{title:'Foreign'})).status,404);
});
test('online chat persists clarification, correction, idempotent replay and rolls back all writes on storage failure',async t=>{
 const {request,db}=await harness(t);await request('/auth/login','POST',{email:'ana@example.com',password:'long-password'});
 const send=(text,requestId)=>request('/chat','POST',{text,requestId});
 const first=await send('Tenho dentista quinta às 10 e preciso levar os exames.','dentist');assert.equal(first.status,200);assert.equal(first.body.items.length,2);
 assert.deepEqual((await send('Tenho dentista quinta às 10 e preciso levar os exames.','dentist')).body,first.body);
 assert.equal((await send('different','dentist')).status,409);assert.equal((await request('/messages')).body.messages.length,2);
 const corrected=await send('Não, sábado.','correct');assert.equal(corrected.body.items[0].id,first.body.items[0].id);
 assert.equal((await send('desfazer','undo')).status,200);assert.equal((await request('/items')).body.items[0].dueAt,first.body.items[0].dueAt);
 assert.equal((await send('Me lembra sexta de enviar o contrato.','clarify')).body.clarification,true);
 assert.equal((await send('às 14','resolve')).body.items[0].type,'reminder');
 await db.exec(`CREATE FUNCTION reject_task() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type='task' THEN RAISE EXCEPTION 'storage failure'; END IF;RETURN NEW;END;$$;CREATE TRIGGER reject_task BEFORE INSERT ON items FOR EACH ROW EXECUTE FUNCTION reject_task();`);
 const n=(await request('/items')).body.items.length,m=(await request('/messages')).body.messages.length;
 assert.equal((await send('Tenho dentista quinta às 10 e preciso levar os exames.','atomic')).status,500);
 assert.equal((await request('/items')).body.items.length,n);assert.equal((await request('/messages')).body.messages.length,m);
 await db.exec('DROP TRIGGER reject_task ON items');assert.equal((await send('Tenho dentista quinta às 10 e preciso levar os exames.','atomic')).status,200);
});
test('online profile summary export calendar voice and account deletion preserve API contract',async t=>{
 const {request,db}=await harness(t);await request('/auth/login','POST',{email:'ana@example.com',password:'long-password'});
 assert.equal((await request('/auth/me')).body.user.plan,'free');
 assert.equal((await request('/profile','PATCH',{name:'Ana Maria',onboarded:true,preferences:{morningSummary:true}})).body.user.preferences.morningSummary,true);
 assert.equal((await request('/profile','PATCH',{plan:'premium'})).status,400);
 assert.equal((await request('/profile','PATCH',{timezone:'Mars/Invalid'})).status,400);
 await request('/items','POST',{type:'event',title:'Doctor, visit',dueAt:'2030-01-10T13:00:00Z',priority:true});
 assert.equal((await request('/summary')).body.pendingCount,1);
 const calendar=await request('/calendar.ics');assert.match(calendar.body,/BEGIN:VCALENDAR/);assert.ok(calendar.body.includes('Doctor'+String.fromCharCode(92)+', visit'));assert.match(calendar.headers.get('content-disposition'),/attachment/);
 const exported=await request('/export');assert.equal(exported.body.items.length,1);assert.ok(!JSON.stringify(exported.body).includes('refresh_token'));
 assert.equal((await request('/voice/capabilities')).body.configured,false);
 assert.equal((await request('/integrations')).body.calendar,'export-only');
 assert.equal((await request('/account','DELETE',{confirmation:'wrong'})).status,400);
 assert.equal((await request('/account','DELETE',{confirmation:'EXCLUIR'})).status,200);
 assert.equal((await db.query('SELECT count(*)::int n FROM items')).rows[0].n,0);assert.equal((await request('/auth/me')).status,401);
});
test('signup requiring confirmation never creates a session and logout revokes the provider session',async t=>{
 let revoked=0;const {request}=await harness(t,{logout:async token=>{assert.equal(token,'valid');revoked++;}});
 const registered=await request('/auth/register','POST',{name:'Ana',email:'ana@example.com',password:'long-password'});
 assert.equal(registered.status,202);assert.equal(registered.body.confirmationRequired,true);assert.equal(registered.body.user,null);assert.equal(registered.headers.get('set-cookie'),null);
 assert.equal((await request('/auth/me')).status,401);
 await request('/auth/login','POST',{email:'ana@example.com',password:'long-password'});
 assert.equal((await request('/auth/logout','POST',{})).status,200);assert.equal(revoked,1);assert.equal((await request('/auth/me')).status,401);
});
test('expired access tokens refresh only through provider then verify identity',async t=>{
 let expiry=false,refreshed=0;
 const {request}=await harness(t,{user:async token=>token==='renewed'||token==='valid'&&!expiry?{id:uid,email:'ana@example.com'}:null,refresh:async token=>{assert.equal(token,'refresh');refreshed++;return {access_token:'renewed',refresh_token:'rotated',expires_in:3600};}});
 await request('/auth/login','POST',{email:'ana@example.com',password:'long-password'});expiry=true;
 assert.equal((await request('/auth/me')).status,200);assert.equal(refreshed,1);assert.equal((await request('/auth/me')).status,200);assert.equal(refreshed,1);
});
test('online undo restores original timestamps and supports undoing an earlier creation after reverting an edit',async t=>{
 const {request}=await harness(t);await request('/auth/login','POST',{email:'ana@example.com',password:'long-password'});
 const created=await request('/items','POST',{type:'task',title:'Original'}),edited=await request('/items/'+created.body.item.id,'PATCH',{title:'Changed'});
 assert.equal((await request('/undo/'+edited.body.undoId,'POST',{})).status,200);
 assert.deepEqual((await request('/items')).body.items[0],created.body.item);
 assert.equal((await request('/undo/'+created.body.undoId,'POST',{})).status,200);
 assert.equal((await request('/items')).body.items.length,0);
});
test('profile patches merge the locked current row rather than overwriting a newer unrelated preference',async t=>{
 let update=false;const {request}=await harness(t,{},async(db,sql)=>{if(update&&sql==='BEGIN'){update=false;await db.query('UPDATE profiles SET morning_summary=true WHERE id=$1',[uid]);}});
 await request('/auth/login','POST',{email:'ana@example.com',password:'long-password'});update=true;
 const result=await request('/profile','PATCH',{name:'Changed'});assert.equal(result.status,200);assert.equal(result.body.user.preferences.morningSummary,true);
});
test('logout clears an already invalid session without pretending an invalid token was revoked',async t=>{
 let invalid=false;const {request}=await harness(t,{user:async()=>invalid?null:{id:uid,email:'ana@example.com'},refresh:async()=>{throw Object.assign(Error('expired'),{status:401});},logout:async()=>{assert.equal(invalid,false);}});
 await request('/auth/login','POST',{email:'ana@example.com',password:'long-password'});invalid=true;
 assert.equal((await request('/auth/logout','POST',{})).status,200);assert.equal((await request('/auth/me')).status,401);
});
test('online server locks target items as well as owner profile before an update',async t=>{
 const sql=[];const {request}=await harness(t,{},async(db,query)=>sql.push(query));await request('/auth/login','POST',{email:'ana@example.com',password:'long-password'});
 const created=await request('/items','POST',{type:'task',title:'Lock target'});sql.length=0;
 assert.equal((await request('/items/'+created.body.item.id,'PATCH',{title:'Changed'})).status,200);
 assert.ok(sql.some(q=>/SELECT.*public.items.*FOR UPDATE/.test(q)));
});
test('online owner scoping rejects actual foreign items, history and forged cookies',async t=>{
 const other='22222222-2222-4222-8222-222222222222';
 const {request,db}=await harness(t,{login:async email=>({access_token:email==='b@example.com'?'other':'valid',refresh_token:'refresh'}),user:async token=>({id:token==='other'?other:uid,email:token==='other'?'b@example.com':'ana@example.com'})});
 await db.query('INSERT INTO auth.users(id) VALUES($1)',[other]);
 await request('/auth/login','POST',{email:'ana@example.com',password:'long-password'});
 const privateItem=await request('/items','POST',{type:'memory',title:'Private A'});
 assert.equal((await request('/items','POST',{type:'task',title:'Forged'},{Origin:'https://evil.example'})).status,403);
 assert.equal((await request('/items','POST',{type:'task',title:'Forged',user_id:other})).status,400);
 await request('/auth/login','POST',{email:'b@example.com',password:'long-password'});
 assert.equal((await request('/items')).body.items.length,0);
 assert.equal((await request('/items/'+privateItem.body.item.id,'PATCH',{title:'Stolen'})).status,404);
 assert.equal((await request('/items/'+privateItem.body.item.id,'DELETE')).status,404);
 assert.equal((await request('/undo/'+privateItem.body.undoId,'POST',{})).status,404);
 assert.ok(!JSON.stringify((await request('/export')).body).includes('Private A'));
 assert.equal((await request('/auth/me','GET',undefined,{Cookie:'mentra_online=forged'})).status,401);
});
export {harness};
