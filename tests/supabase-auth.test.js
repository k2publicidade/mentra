import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
test('Supabase Auth transport verifies identity remotely, encodes credentials and rejects upstream failures',async t=>{
 const {createSupabaseAuth}=await import('../server/supabase-auth.js');
 const calls=[];let status=200,malformed=false;
 const server=createServer(async(req,res)=>{let raw='';for await(const b of req)raw+=b;calls.push({url:req.url,auth:req.headers.authorization,body:raw?JSON.parse(raw):null});res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(malformed?{}:req.url==='/auth/v1/user'?{id:'11111111-1111-4111-8111-111111111111',email:'ana@example.com'}:{access_token:'access',refresh_token:'refresh'}));});server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const auth=createSupabaseAuth({url:`http://127.0.0.1:${server.address().port}`,key:'public-test',serviceKey:'server-test',allowLoopback:true});
 await auth.login('ana@example.com',' password ');assert.deepEqual(calls[0].body,{email:'ana@example.com',password:' password '});
 assert.equal((await auth.user('access')).email,'ana@example.com');assert.equal(calls[1].auth,'Bearer access');
 await auth.signup({email:'ana@example.com',password:'long-password',data:{name:'Ana'}});assert.equal(calls[2].url,'/auth/v1/signup');
 await auth.refresh('refresh');assert.equal(calls[3].url,'/auth/v1/token?grant_type=refresh_token');
 await auth.logout('access');await auth.deleteUser('11111111-1111-4111-8111-111111111111');assert.equal(calls[5].auth,'Bearer server-test');
 status=401;assert.equal(await auth.user('invalid'),null);await assert.rejects(auth.login('a','b'),e=>e.status===401);
 status=500;await assert.rejects(auth.user('access'),e=>e.status===502);
 status=200;malformed=true;await assert.rejects(auth.signup({email:'a',password:'b'}),e=>e.status===502);
 assert.throws(()=>createSupabaseAuth({url:'http://evil.example',key:'x',serviceKey:'x'}),/HTTPS/);
});
