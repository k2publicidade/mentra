import {tmpdir} from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import https from 'node:https';
const tls=resolve('data/tls');
test('inicializador móvel seleciona HTTPS e rede local', {skip:!existsSync(join(tls,'server.crt'))}, async t=>{
 const dir=mkdtempSync(join(tmpdir(),'mentra-mobile-'));
 const child=spawn(process.execPath,['scripts/start-mobile.js'],{cwd:process.cwd(),env:{...process.env,MOBILE_PORT:'0',DB_PATH:join(dir,'db.sqlite')},stdio:['ignore','pipe','pipe']});
 let logs='';
 t.after(async()=>{child.kill();await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);});rmSync(dir,{recursive:true,force:true});});
 const output=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs)),5000);child.stdout.on('data',d=>{logs+=d;if(logs.includes('disponível em')){clearTimeout(timer);resolve(logs);}});child.stderr.on('data',d=>logs+=d);child.once('exit',()=>{clearTimeout(timer);reject(Error(logs));});});
 assert.match(output,/https:\/\/0\.0\.0\.0:\d+/);
});
test('HTTPS local assinado por CA permite sessão Secure e leitura verificada', {skip:!existsSync(join(tls,'server.crt'))}, async t=>{
 const dir=mkdtempSync(join(tmpdir(),'mentra-https-'));
 const child=spawn(process.execPath,['server/index.js'],{cwd:process.cwd(),env:{...process.env,HOST:'127.0.0.1',PORT:'0',DB_PATH:join(dir,'db.sqlite'),NODE_ENV:'production',TLS_CERT_PATH:join(tls,'server.crt'),TLS_KEY_PATH:join(tls,'server.key')},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{child.kill();await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);});rmSync(dir,{recursive:true,force:true});});
 let logs='';const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs)),5000);child.stdout.on('data',d=>{logs+=d;const m=logs.match(/https?:\/\/[^\s]+/);if(m){clearTimeout(timer);resolve(m[0]);}});child.stderr.on('data',d=>logs+=d);child.once('exit',()=>{clearTimeout(timer);reject(Error(logs));});});
 assert.match(url,/^https:\/\//);
 const request=(path,method='GET',data)=>new Promise((resolve,reject)=>{const req=https.request(url+path,{ca:readFileSync(join(tls,'mentra-root-ca.crt')),method,headers:data?{'Content-Type':'application/json'}:{}},res=>{let body='';res.on('data',d=>body+=d);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(body)}));});req.on('error',reject);req.end(data?JSON.stringify(data):undefined);});
 assert.equal((await request('/api/health')).body.ok,true);
 const result=await request('/api/auth/register','POST',{name:'HTTPS Test',email:'https@example.com',password:'test-password-valid',timezone:'America/Sao_Paulo'});
 assert.equal(result.status,201);assert.match(result.headers['set-cookie'][0],/Secure/);
});
