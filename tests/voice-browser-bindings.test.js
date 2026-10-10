import test from 'node:test';
import assert from 'node:assert/strict';
import {browserVoiceDependencies} from '../src/voice.js';
test('adaptador mantém receiver Window dos timers nativos do gravador',t=>{
 const originalSet=globalThis.setInterval,originalClear=globalThis.clearInterval;
 t.after(()=>{globalThis.setInterval=originalSet;globalThis.clearInterval=originalClear;});
 globalThis.setInterval=function(callback,delay){if(this!==globalThis)throw TypeError('Illegal invocation');assert.equal(delay,250);return 42;};
 globalThis.clearInterval=function(id){if(this!==globalThis)throw TypeError('Illegal invocation');assert.equal(id,42);};
 const deps=browserVoiceDependencies();
 assert.equal(deps.setInterval(()=>{},250),42);
 assert.doesNotThrow(()=>deps.clearInterval(42));
});
