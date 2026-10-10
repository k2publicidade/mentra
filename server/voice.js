import express from 'express';
export function installVoice(app,options={}){
 const provider=options.provider ?? process.env.VOICE_PROVIDER ?? 'brainiall';
 if(!['brainiall','openai'].includes(provider))throw new Error('Provedor de transcrição inválido.');
 const apiKey=options.apiKey ?? (provider==='brainiall'?process.env.BRAINIALL_API_KEY:process.env.OPENAI_API_KEY);
 const model=options.model ?? process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-transcribe';
 const endpoint=options.endpoint ?? (provider==='brainiall'?'https://api.brainiall.com/v1/whisper/transcribe':'https://api.openai.com/v1/audio/transcriptions');
 const transport=options.transport ?? fetch;
 const rates=new Map(),clock=options.now??Date.now;
 const rateMax=options.rateMax??5,active=new Set(),timeoutMs=options.timeoutMs??45000;
 const raw=express.raw({type:()=>true,limit:10485760,inflate:false});
 const readAudio=(req,res,next)=>raw(req,res,error=>{
  // Aborted/expired uploads must not reach Express's generic error logger.
  if(res.writableEnded||res.destroyed)return;
  if(error)return res.status(error.status===413?413:400).json({error:error.status===413?'O áudio excede o limite de 10 MB.':'Não foi possível ler o áudio enviado.'});
  next();
 });
 app.get('/api/voice/capabilities',(req,res)=>res.json({configured:Boolean(apiKey),provider,maxBytes:10485760,maxDurationSeconds:120,formats:['audio/webm','audio/mp4','audio/wav','audio/mpeg']}));
 app.post('/api/voice/transcribe',(req,res,next)=>{
  if(!apiKey)return res.status(503).json({error:'Transcrição externa não configurada.'});
  const mime=req.get('content-type')?.split(';')[0].trim().toLowerCase();
  if(!['audio/webm','audio/mp4','audio/wav','audio/mpeg'].includes(mime)||req.get('content-encoding')&&req.get('content-encoding')!=='identity')return res.status(415).json({error:'Formato de áudio não suportado.'});
  if(active.has(req.user.id))return res.set('Retry-After','1').status(429).json({error:'Já há uma transcrição em andamento nesta conta.'});
  const time=clock();for(const [uid,entry] of rates)if(time>=entry.until)rates.delete(uid);
  const entry=rates.get(req.user.id)??{count:0,until:time+60000};
  if(entry.count>=rateMax)return res.set('Retry-After',String(Math.max(1,Math.ceil((entry.until-time)/1000)))).status(429).json({error:'Limite de transcrições atingido. Aguarde um minuto.'});
  entry.count++;rates.set(req.user.id,entry);
  active.add(req.user.id);req.voiceController=new AbortController();
  const cleanup=()=>{clearTimeout(timer);active.delete(req.user.id);req.voiceController.abort();req.body=undefined;req.off('aborted',cleanup);res.off('finish',cleanup);res.off('close',cleanup);if(!req.complete)req.destroy();};
  const timer=setTimeout(()=>{req.voiceController.abort();if(!res.writableEnded&&!res.destroyed)res.status(504).json({error:'A transcrição demorou demais. Tente novamente.'});},timeoutMs);timer.unref();
  req.once('aborted',cleanup);res.once('finish',cleanup);res.once('close',cleanup);
  req.audioMime=mime;next();
 },readAudio,async(req,res)=>{
  const b=req.body;if(!Buffer.isBuffer(b)||!b.length)return res.status(400).json({error:'O áudio está vazio.'});
  const mime=req.audioMime;
  const valid=mime==='audio/webm'?b.length>=4&&b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])):mime==='audio/mp4'?b.length>=12&&b.toString('ascii',4,8)==='ftyp':mime==='audio/wav'?b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WAVE':b.length>=3&&(b.toString('ascii',0,3)==='ID3'||b[0]===0xff&&(b[1]&0xe0)===0xe0&&(b[1]&0x06)!==0&&(b[2]&0xf0)!==0xf0&&(b[2]&0xf0)!==0);
  if(!valid)return res.status(415).json({error:'O arquivo não corresponde ao formato de áudio informado.'});
  const extension={'audio/webm':'webm','audio/mp4':'mp4','audio/wav':'wav','audio/mpeg':'mp3'}[mime];
  const form=new FormData();
  if(provider==='brainiall'){form.set('language','pt');form.set('diarize','true');}else{form.set('model',model);form.append(model==='gpt-transcribe'?'languages[]':'language','pt');}
  form.set(provider==='brainiall'?'audio':'file',new Blob([b],{type:mime}),`recording.${extension}`);
  try{
   const upstream=await transport(endpoint,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form,redirect:'error',signal:req.voiceController.signal});
   if(!upstream.ok){await upstream.body?.cancel();return res.status(upstream.status===429?429:upstream.status===402?503:502).json({error:upstream.status===429?'O serviço de transcrição está ocupado. Tente novamente mais tarde.':upstream.status===402?'O serviço de transcrição está sem créditos. Contate o administrador.':'O serviço de transcrição não respondeu corretamente.'});}
   const chunks=[];let total=0;
   for await(const chunk of upstream.body){total+=chunk.byteLength;if(total>262144)throw new Error('Provider response too large');chunks.push(Buffer.from(chunk));}
   const data=JSON.parse(Buffer.concat(chunks,total).toString('utf8'));
   if(provider==='brainiall'){
    if(!Array.isArray(data?.words)||!data.words.length||data.words.some(w=>!w||typeof(w.word??w.text)!=='string'||!Number.isFinite(w.start)||w.start<0||!Number.isFinite(w.end)||w.end<=0||w.end<w.start||!(typeof w.speaker==='string'||typeof w.speaker==='number'&&Number.isFinite(w.speaker))))return res.status(502).json({error:'Resposta inválida do serviço de transcrição.'});
    if(data.text===undefined)data.text=data.words.map(w=>w.word??w.text).join(' ');
   }
   if(typeof data?.text!=='string')return res.status(502).json({error:'Resposta inválida do serviço de transcrição.'});
   const text=data.text.trim();if(!text||text.length>2000)return res.status(422).json({error:!text?'Nenhuma fala identificada. Tente gravar novamente.':'A transcrição excede 2000 caracteres. Grave um áudio menor.'});
   res.json({text,provider});
  }catch{if(!res.writableEnded&&!res.destroyed)return res.status(502).json({error:'Não foi possível acessar o serviço de transcrição.'});}
 });
}
