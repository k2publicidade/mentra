import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
test('HOST explícito permite implantação em container sem mudar padrão loopback',async t=>{
 const dir=mkdtempSync(join(process.env.TMPDIR,'mentra-host-'));
 const child=spawn(process.execPath,['server/index.js'],{cwd:process.cwd(),env:{...process.env,PORT:'0',HOST:'0.0.0.0',DB_PATH:join(dir,'db.sqlite')},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{child.kill();await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);});rmSync(dir,{recursive:true,force:true});});
 let logs=''; const address=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs)),5000);child.stdout.on('data',d=>{logs+=d;const m=logs.match(/http:\/\/([^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.stderr.on('data',d=>logs+=d);child.once('exit',()=>{clearTimeout(timer);reject(Error(logs));});});
 assert.match(address,/^0\.0\.0\.0:\d+$/);
 const port=address.split(':').at(-1);
 assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`).then(r=>r.json())).ok,true);
});
