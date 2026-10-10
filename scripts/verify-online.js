import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';

// Opt-in: creates only uniquely named test accounts and removes them through the app API.
if(!process.argv.includes('--allow-test-accounts'))throw Error('Use --allow-test-accounts to authorize disposable test accounts.');
const origin=new URL(process.env.APP_ORIGIN||'https://mentra-tawny.vercel.app').origin;
if(!origin.startsWith('https://'))throw Error('Online verification requires HTTPS.');
const accounts=[];
function client(){
 let cookie='';
 return async(path,method='GET',body)=>{
  const res=await fetch(origin+'/api'+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const set=res.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
  const data=res.headers.get('content-type')?.includes('application/json')?await res.json():await res.text();
  return {status:res.status,data,headers:res.headers};
 };
}
const a=client(),b=client();
async function register(request){
 const credentials={name:'Verificação online descartável',email:`mentra-check-${randomUUID()}@example.com`,password:randomBytes(24).toString('hex'),timezone:'America/Sao_Paulo'};
 const result=await request('/auth/register','POST',credentials);
 if(result.status===202)throw Error('Email confirmation is enabled; use a confirmed test account workflow.');
 assert.equal(result.status,201,JSON.stringify(result.data));accounts.push(request);
 assert.ok(result.data.user?.id);assert.match(result.headers.get('set-cookie'),/HttpOnly/);assert.match(result.headers.get('set-cookie'),/Secure/);
 assert.ok(!JSON.stringify(result.data).includes('access_token'));
 return credentials;
}
try{
 assert.deepEqual((await a('/health')).data,{ok:true,storage:'supabase'});
 assert.equal((await a('/items')).status,401);
 const credentials=await register(a);await register(b);
 console.log('PASS: real Supabase signup, encrypted Secure/HttpOnly sessions, anonymous protection');
 for(const type of ['task','event','reminder','memory']){
  const created=await a('/items','POST',{type,title:`Teste online ${type}`,...(type==='event'||type==='reminder'?{dueAt:'2030-01-10T13:00:00Z'}:{})});
  assert.equal(created.status,201,JSON.stringify(created.data));const id=created.data.item.id;
  assert.equal((await b(`/items/${id}`,'PATCH',{title:'Acesso indevido'})).status,404);
  assert.equal((await b(`/undo/${created.data.undoId}`,'POST',{})).status,404);
  const edited=await a(`/items/${id}`,'PATCH',{title:'Teste online editado'});assert.equal(edited.status,200);
  assert.equal((await a(`/undo/${edited.data.undoId}`,'POST',{})).status,200);
  assert.equal((await a(`/undo/${created.data.undoId}`,'POST',{})).status,200);
 }
 assert.equal((await a('/items')).data.items.length,0);
 console.log('PASS: all four item types, edits, chained undo, ownership isolation');
 const chat={text:'Tenho dentista quinta às 10 e preciso levar os exames.',requestId:randomUUID()};
 const replay=await Promise.all([a('/chat','POST',chat),a('/chat','POST',chat)]);
 for(const r of replay)assert.equal(r.status,200,JSON.stringify(r.data));assert.deepEqual(replay[0].data,replay[1].data);
 assert.equal((await a('/items')).data.items.length,2);assert.equal((await a('/messages')).data.messages.length,2);
 assert.equal((await a('/chat','POST',{text:'Não, sábado.',requestId:randomUUID()})).status,200);
 assert.equal((await a('/items')).data.items.length,2);
 assert.equal((await a('/chat','POST',{text:'desfazer',requestId:randomUUID()})).status,200);
 const clarify=await a('/chat','POST',{text:'Me lembra sexta de enviar o contrato.',requestId:randomUUID()});assert.equal(clarify.data.clarification,true);
 assert.equal((await a('/chat','POST',{text:'às 14',requestId:randomUUID()})).status,200);
 console.log('PASS: concurrent idempotency, chat capture/correction/undo/clarification');
 const priorities=await Promise.all(Array.from({length:4},(_,i)=>a('/items','POST',{type:'task',title:`Prioridade teste ${i}`,priority:true})));
 assert.equal(priorities.filter(r=>r.status===201).length,3);assert.equal(priorities.filter(r=>r.status===409).length,1);
 assert.equal((await a('/summary')).data.priorities.length,3);
 const profile=await Promise.all([a('/profile','PATCH',{preferences:{morningSummary:true}}),a('/profile','PATCH',{preferences:{eveningSummary:true}})]);
 for(const r of profile)assert.equal(r.status,200);
 const me=await a('/auth/me');assert.equal(me.data.user.preferences.morningSummary,true);assert.equal(me.data.user.preferences.eveningSummary,true);
 assert.equal((await b('/items')).data.items.length,0);
 assert.ok((await a('/export')).data.items.length>0);assert.match((await a('/calendar.ics')).data,/BEGIN:VCALENDAR/);
 assert.equal((await a('/items','POST',{type:'event',title:'Data inválida',dueAt:'2026-02-31T10:00:00Z'})).status,400);
 console.log('PASS: concurrent priority constraints/profile merges, export, calendar, invalid dates');
 assert.equal((await a('/auth/logout','POST',{})).status,200);assert.equal((await a('/auth/me')).status,401);
 assert.equal((await a('/auth/login','POST',{email:credentials.email,password:credentials.password})).status,200);
 assert.ok((await a('/items')).data.items.length>0);
 const voice=await a('/voice/capabilities');assert.equal(voice.status,200);console.log(`VOICE: configured=${voice.data.configured}, provider=${voice.data.provider}`);
 console.log('PASS: logout, real provider login, persisted data after a new session');
}finally{
 const failures=[];
 for(const request of accounts){try{const r=await request('/account','DELETE',{confirmation:'EXCLUIR'});assert.equal(r.status,200);assert.equal((await request('/auth/me')).status,401);}catch{failures.push('Test account cleanup failed.');}}
 if(failures.length)throw Error(failures.join(' '));
 if(accounts.length)console.log('PASS: disposable accounts deleted through Auth admin cascade');
}
