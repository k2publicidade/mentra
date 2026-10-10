import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
test('Vercel routes every API request to an online-only handler without importing SQLite or starting a listener',async t=>{
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(config.outputDirectory,'dist');assert.equal(config.buildCommand,'npm run build');
 assert.equal(config.routes[0].dest,'/api/index.js');assert.ok(new RegExp(config.routes[0].src).test('/api/items'));assert.ok(config.routes.some(r=>r.handle==='filesystem'));
 const source=await readFile(new URL('../api/index.js',import.meta.url),'utf8');assert.ok(!source.includes('app.js\''));assert.ok(!source.includes('.listen('));
 const {default:handler}=await import('../api/index.js');const server=createServer(handler);server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const res=await fetch(`http://127.0.0.1:${server.address().port}/api/health`);assert.equal(res.status,503);assert.deepEqual(await res.json(),{error:'Backend online não configurado.'});
});
test('Vercel static pages receive same-origin microphone and script policies without exposing keys',async()=>{
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
 const headers=config.routes.find(r=>r.continue===true)?.headers;
 assert.equal(headers?.['Permissions-Policy'],'microphone=(self)');assert.match(headers?.['Content-Security-Policy']||'',/script-src 'self'/);
 assert.equal(config.env,undefined);
});
test('online configuration requires explicit server-only settings and verified TLS',async()=>{
 const {onlineConfig,createOnlineRuntime}=await import('../server/online-runtime.js');
 assert.throws(()=>onlineConfig({}),/SUPABASE_URL/);
 const env={SUPABASE_URL:'https://mmhvbjmetsuscnyzsvxg.supabase.co',SUPABASE_ANON_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'private-test',DATABASE_URL:'postgresql://user:pass@db.example/postgres',SESSION_SECRET:'a'.repeat(64),APP_ORIGIN:'https://mentra.example'};
 const config=onlineConfig(env);
 assert.equal(config.pool.ssl.rejectUnauthorized,true);assert.equal(config.pool.max,3);assert.equal(config.origin,'https://mentra.example');
 const app=createOnlineRuntime(env);assert.equal(app.get('trust proxy'),1);await app.locals.pool.end();
 assert.throws(()=>onlineConfig({...env,APP_ORIGIN:'http://evil.example'}),/configuration|APP_ORIGIN/);
});
