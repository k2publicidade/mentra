// TEST-ONLY fixture. Uses synthetic transcription, never a real paid provider.
import http from 'node:http';
import {createApp} from '../server/app.js';
let calls=0,uploads=[];
const provider=http.createServer(async(req,res)=>{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const bytes=Buffer.concat(chunks);calls++;
 uploads.push({size:bytes.length,contentType:req.headers['content-type'],hasAudioField:bytes.includes(Buffer.from('name="audio"')),hasPt:bytes.includes(Buffer.from('\r\npt\r\n')),hasWebmMagic:bytes.includes(Buffer.from([0x1a,0x45,0xdf,0xa3]))});
 res.writeHead(200,{'Content-Type':'application/json'});
 res.end(JSON.stringify({text:'Preciso revisar o contrato.',words:[{word:'Preciso',start:0,end:0.5,speaker:'SPEAKER_00'},{word:'revisar',start:0.5,end:1,speaker:'SPEAKER_00'},{word:'o contrato.',start:1,end:2,speaker:'SPEAKER_00'}]}));
});
await new Promise(r=>provider.listen(0,'127.0.0.1',r));
const endpoint=`http://127.0.0.1:${provider.address().port}/v1/whisper/transcribe`;
const app=createApp({dbPath:':memory:',voiceOptions:{provider:'brainiall',apiKey:'contract-test-only',endpoint}});
// No real secrets or user audio are logged, even by this test fixture.
app.get('/__test/voice-evidence',(req,res)=>res.json({calls,uploads}));
const server=app.listen(3110,'127.0.0.1',()=>console.log('TEST-ONLY MENTRA voice fixture 3110'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();provider.close();app.locals.db.close();process.exit(0);});
