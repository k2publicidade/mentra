import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createApp} from '../server/app.js';
const audio=Buffer.from([0x1a,0x45,0xdf,0xa3,1,2,3,4]);
async function fixture(t,voiceOptions={apiKey:''},providerHandler){
 voiceOptions={provider:'openai',...voiceOptions};
 let provider;
 if(providerHandler){provider=http.createServer(providerHandler);await new Promise(r=>provider.listen(0,'127.0.0.1',r));voiceOptions={apiKey:'contract-test-key',endpoint:`http://127.0.0.1:${provider.address().port}/v1/audio/transcriptions`,...voiceOptions};}
 if(!provider)voiceOptions={transport:()=>{throw new Error('External network forbidden in tests');},...voiceOptions};
 const app=createApp({dbPath:':memory:',voiceOptions});const server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));if(provider){provider.closeAllConnections();await new Promise(r=>provider.close(r));}app.locals.db.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 async function register(email){const r=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Teste',email,password:'long-test-password'})});assert.equal(r.status,201);return r.headers.get('set-cookie').split(';')[0];}
 const cookie=await register('voice@example.test');
 const post=(body=audio,headers={},who=cookie,path='/api/voice/transcribe')=>fetch(base+path,{method:'POST',headers:{cookie:who,'content-type':'audio/webm;codecs=opus',...headers},body});
 return {app,base,cookie,post,register};
}
test('loopback HTTP provider contract sends multipart audio and Portuguese model parameters without persisting',async t=>{
 let received;const f=await fixture(t,{model:'gpt-transcribe'},async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);received={url:req.url,headers:req.headers,body:Buffer.concat(chunks)};res.setHeader('content-type','application/json');res.end(JSON.stringify({text:'  Comprar pão amanhã  '}));});
 const r=await f.post();assert.equal(r.status,200);assert.deepEqual(await r.json(),{text:'Comprar pão amanhã',provider:'openai'});
 assert.equal(received.url,'/v1/audio/transcriptions');assert.equal(received.headers.authorization,'Bearer contract-test-key');assert.match(received.headers['content-type'],/^multipart\/form-data; boundary=/);assert.ok(received.body.includes(audio));const body=received.body.toString();assert.match(body,/name="model"\r\n\r\ngpt-transcribe/);assert.match(body,/name="languages\[\]"\r\n\r\npt/);assert.match(body,/filename="recording.webm"/);
 assert.deepEqual((await (await fetch(f.base+'/api/messages',{headers:{cookie:f.cookie}})).json()).messages,[]);assert.equal(f.app.locals.db.prepare('SELECT count(*) AS n FROM items').get().n,0);
});
test('upload validation rejects unconfigured, unauthenticated, cross-site, wrong MIME, empty, mismatched magic and oversize before provider',async t=>{
 const absent=await fixture(t);assert.equal((await absent.post()).status,503);
 let calls=0;const f=await fixture(t,{apiKey:'contract-test-key'},(req,res)=>{calls++;res.end('{"text":"ok"}');});
 assert.equal((await f.post(audio,{},'')).status,401);
 assert.equal((await f.post(audio,{origin:'https://evil.test'})).status,403);assert.equal((await f.post(audio,{'sec-fetch-site':'cross-site'})).status,403);
 assert.equal((await f.post(audio,{'content-type':'audio/ogg'})).status,415);assert.equal((await f.post(Buffer.alloc(0))).status,400);assert.equal((await f.post(Buffer.from('not audio'))).status,415);assert.equal((await f.post(audio,{'content-type':'audio/mp4'})).status,415);
 const tooBig=Buffer.alloc(10485761);audio.copy(tooBig);assert.equal((await f.post(tooBig)).status,413);
 assert.equal((await f.post(audio,{},f.cookie,'/api/items')).status,400);assert.equal((await f.post(audio,{},f.cookie,'/api/voice/transcribe/')).status,400);assert.equal(calls,0);
});
test('provider status and invalid transcript errors are sanitized and never silently truncate',async t=>{
 let result={status:200,body:'{"text":"ok"}'};const f=await fixture(t,{apiKey:'contract-test-key',rateMax:20},async(req,res)=>{for await(const c of req){}res.statusCode=result.status;res.end(result.body);});
 for(const [status,body,expected] of [[429,'secret upstream',429],[401,'contract-test-key',502],[500,'secret upstream',502],[200,'not JSON secret',502],[200,'{"text":42}',502],[200,'{"text":"  "}',422],[200,JSON.stringify({text:'x'.repeat(2001)}),422]]){result={status,body};const r=await f.post();assert.equal(r.status,expected);const data=await r.json();assert.equal(typeof data.error,'string');assert.doesNotMatch(JSON.stringify(data),/contract-test-key|secret upstream|not JSON/);}
});
test('BRAINIALL loopback contract uses audio, pt and diarize and validates word schema before fallback',async t=>{
 let body;let response={words:[{word:'Comprar',start:0,end:0.5,speaker:'SPEAKER_00'},{text:'pão',start:0.5,end:1,speaker:0}]};let status=200;
 const f=await fixture(t,{provider:'brainiall',apiKey:'contract-test-key',rateMax:20},async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);body=Buffer.concat(chunks);assert.equal(req.headers.authorization,'Bearer contract-test-key');res.statusCode=status;res.end(JSON.stringify(response));});
 const cap=await (await fetch(f.base+'/api/voice/capabilities',{headers:{cookie:f.cookie}})).json();assert.equal(cap.provider,'brainiall');
 const r=await f.post();assert.equal(r.status,200);assert.deepEqual(await r.json(),{text:'Comprar pão',provider:'brainiall'});const multipart=body.toString();assert.match(multipart,/name="audio"; filename="recording.webm"/);assert.match(multipart,/name="language"\r\n\r\npt/);assert.match(multipart,/name="diarize"\r\n\r\ntrue/);assert.doesNotMatch(multipart,/name="model"/);assert.ok(body.includes(audio));
 for(const invalid of [{text:'ok'}, {words:[]},{text:'ok',words:[{word:'x',start:0,end:1}]},{words:[{word:'x',start:2,end:1,speaker:'A'}]}]){response=invalid;assert.equal((await f.post()).status,502);}
 status=402;response={error:'contract-test-key'};const credit=await f.post();assert.equal(credit.status,503);assert.match((await credit.json()).error,/crédito/);
});
test('per-user rate limit resets and another authenticated account is isolated',async t=>{
 let clock=1000;let calls=0;const f=await fixture(t,{apiKey:'contract-test-key',now:()=>clock},async(req,res)=>{for await(const c of req){}calls++;res.end('{"text":"ok"}');});
 for(let i=0;i<5;i++)assert.equal((await f.post()).status,200);
 const limited=await f.post();assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
 const other=await f.register('second@example.test');assert.equal((await f.post(audio,{},other)).status,200);clock+=60000;assert.equal((await f.post()).status,200);assert.equal(calls,7);
});
test('one in-flight request per user, provider timeout aborts network and frees slot',async t=>{
 let entered;const ready=new Promise(r=>entered=r);let closed;const aborted=new Promise(r=>closed=r);let hang=true,requests=0;
 const f=await fixture(t,{apiKey:'contract-test-key',timeoutMs:250},async(req,res)=>{for await(const c of req){}if(hang&&requests++===0){res.on('close',closed);entered();}else res.end('{"text":"ok"}');});
 const first=f.post();await ready;assert.equal((await f.post()).status,429);const timed=await first;assert.equal(timed.status,504);await aborted;hang=false;assert.equal((await f.post()).status,200);
});
test('only exact POST transcription bypasses JSON parsing and authentication precedes upload validation',async t=>{
 const f=await fixture(t,{apiKey:'contract-test-key'});
 assert.equal((await f.post('{malformed',{'content-type':'application/json'},'')).status,401);assert.equal((await f.post('{malformed',{'content-type':'application/json'})).status,415);
 assert.equal((await fetch(f.base+'/api/voice/transcribe',{method:'PATCH',headers:{cookie:f.cookie,'content-type':'audio/webm'},body:audio})).status,400);
});
test('provider response memory is bounded even for chunked JSON',async t=>{
 const f=await fixture(t,{apiKey:'contract-test-key'},async(req,res)=>{for await(const c of req){}res.write('{"text":"ok","padding":"');res.end('x'.repeat(262145)+'"}');});const r=await f.post();assert.equal(r.status,502);
});
test('slow streaming uploads time out before external request and release concurrency',async t=>{
 const errors=t.mock.method(console,'error',()=>{});
 let calls=0;const f=await fixture(t,{apiKey:'contract-test-key',timeoutMs:100},async(req,res)=>{for await(const c of req){}calls++;res.end('{"text":"ok"}');});
 const status=await new Promise((resolve,reject)=>{const req=http.request(f.base+'/api/voice/transcribe',{method:'POST',headers:{cookie:f.cookie,'content-type':'audio/webm'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.write(audio);});assert.equal(status,504);assert.equal(calls,0);assert.equal((await f.post()).status,200);assert.equal(errors.mock.callCount(),0);
});
test('client disconnect cancels provider network and releases same-user slot',async t=>{
 let entered,closed;const ready=new Promise(r=>entered=r),aborted=new Promise(r=>closed=r);let calls=0;
 const f=await fixture(t,{apiKey:'contract-test-key'},async(req,res)=>{for await(const c of req){}if(calls++===0){res.on('close',closed);entered();}else res.end('{"text":"ok"}');});
 const req=http.request(f.base+'/api/voice/transcribe',{method:'POST',headers:{cookie:f.cookie,'content-type':'audio/webm'} });req.on('error',()=>{});req.end(audio);await ready;req.destroy();await aborted;assert.equal((await f.post()).status,200);
});
test('chunked upload enforces actual bytes without Content-Length',async t=>{
 let calls=0;const f=await fixture(t,{apiKey:'contract-test-key'},async(req,res)=>{for await(const c of req){}calls++;res.end('{"text":"ok"}');});
 const status=await new Promise((resolve,reject)=>{const req=http.request(f.base+'/api/voice/transcribe',{method:'POST',headers:{cookie:f.cookie,'content-type':'audio/webm'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.write(audio);req.end(Buffer.alloc(10485760));});assert.equal(status,413);assert.equal(calls,0);assert.equal((await f.post()).status,200);
});
test('accepted mobile MIME signatures and legacy OpenAI language are preserved',async t=>{
 let multipart;const f=await fixture(t,{apiKey:'contract-test-key',model:'gpt-4o-transcribe'},async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);multipart=Buffer.concat(chunks).toString();res.end('{"text":"ok"}');});
 for(const [mime,body,ext] of [['audio/mp4;codecs=mp4a.40.2',Buffer.from([0,0,0,20,...Buffer.from('ftypisom')]),'mp4'],['audio/wav',Buffer.from('RIFF1234WAVEdata'),'wav'],['audio/mpeg',Buffer.from('ID3test'),'mp3'],['audio/mpeg',Buffer.from([0xff,0xfb,0x90,0x64]),'mp3']]){assert.equal((await f.post(body,{'content-type':mime})).status,200);assert.match(multipart,new RegExp(`filename="recording\\.${ext}"`));assert.match(multipart,/name="language"\r\n\r\npt/);assert.doesNotMatch(multipart,/name="languages\[\]"/);}
});
test('same-origin microphone permission is explicit',async t=>{const f=await fixture(t);const r=await fetch(f.base+'/api/voice/capabilities',{headers:{cookie:f.cookie}});assert.equal(r.headers.get('permissions-policy'),'microphone=(self)');});
test('invalid provider configuration is rejected without echoing configuration',()=>{assert.throws(()=>createApp({dbPath:':memory:',voiceOptions:{provider:'invalid-secret-value',apiKey:''}}),error=>error.message==='Provedor de transcrição inválido.');});
test('capabilities are authenticated, private and disclose only configuration',async t=>{
 const f=await fixture(t);assert.equal((await fetch(f.base+'/api/voice/capabilities')).status,401);
 const r=await fetch(f.base+'/api/voice/capabilities',{headers:{cookie:f.cookie}});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),{configured:false,provider:'openai',maxBytes:10485760,maxDurationSeconds:120,formats:['audio/webm','audio/mp4','audio/wav','audio/mpeg']});
});
