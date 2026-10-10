const clean=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const days=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
const cap=s=>{s=s.trim().replace(/[.!?]+$/,'');return s.charAt(0).toUpperCase()+s.slice(1);};
export function localParts(date,zone){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));}
function zonedISO(year,month,day,hour,minute,zone){let utc=Date.UTC(year,month-1,day,hour,minute);for(let i=0;i<3;i++){const p=localParts(new Date(utc),zone);utc+=Date.UTC(year,month-1,day,hour,minute)-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);}return new Date(utc).toISOString();}
export function formatDate(iso,zone){return new Intl.DateTimeFormat('pt-BR',{timeZone:zone,dateStyle:'full',timeStyle:'short'}).format(new Date(iso));}
function temporal(input,now,zone,previous){
 const norm=clean(input),p=localParts(now,zone),weekday=norm.match(/\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/),relative=norm.match(/\b(depois de amanha|hoje|amanha)\b/),explicit=norm.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/),time=norm.match(/\b(?:as\s*)?(\d{1,2})(?::(\d{2})|h(?:([0-5]\d))?)(?:\b|$)|\bas\s*(\d{1,2})\b/);
 let date=previous?.date||null,hour=previous?.hour??null,minute=previous?.minute??0,error=null;
 if(weekday){const d=new Date(Date.UTC(p.year,p.month-1,p.day));let delta=(days.indexOf(weekday[1])-d.getUTCDay()+7)%7;if(/proxima|proximo/.test(norm)&&delta===0)delta=7;d.setUTCDate(d.getUTCDate()+delta);date=[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()];}
 if(relative){const d=new Date(Date.UTC(p.year,p.month-1,p.day));d.setUTCDate(d.getUTCDate()+({'hoje':0,'amanha':1,'depois de amanha':2}[relative[1]]));date=[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()];}
 if(explicit){date=[Number(explicit[3]||p.year),Number(explicit[2]),Number(explicit[1])];const d=new Date(Date.UTC(date[0],date[1]-1,date[2]));if(d.getUTCMonth()+1!==date[1]||d.getUTCDate()!==date[2]){date=null;error='Qual é a data válida (dia/mês/ano)?';}}
 if(time){hour=Number(time[1]||time[4]);minute=Number(time[2]||time[3]||0);if(hour>23||minute>59){hour=null;error='Qual é o horário válido, entre 00:00 e 23:59?';}}
 if(/\bou\b/.test(norm)&&(weekday||explicit||time)){if(weekday||explicit){date=null;error='Qual é a data que você escolheu?';}else{hour=null;error='Qual é o horário que você escolheu?';}}
 return {date,hour,minute,error,hasDate:!!(weekday||relative||explicit),hasTime:!!time};
}
export function parseCapture(input,{now=new Date(),timezone='America/Sao_Paulo',pending=null,lastItem=null}={}){
 input=input.trim();const norm=clean(input);
 if(/\b(toda|todo|diariamente|semanalmente|mensalmente|recorrente|a cada)\b/.test(norm)&&/lembra|lembre|tenho|preciso|agenda/.test(norm))return {action:'help',reply:'Ainda não agendo recorrências no modo local. Nada foi salvo. Diga uma data e um horário para registrar uma ocorrência.'};
 if(/^(desfazer|desfaca|voltar atras)[.!]?$/.test(norm))return {action:'undo'};
 if(/^(cancelar|deixa pra la|esquece)[.!]?$/.test(norm)&&pending)return {action:'cancel',reply:'Cancelei a captura pendente. Nada foi salvo.'};
 if(/^(?:minhas?\s+)?(?:tarefas|memorias|lembretes|agenda)(?:\?|\.)?$/.test(norm)||/o que tenho|meus compromissos|o que.*hoje/.test(norm)){const type=/tarefa/.test(norm)?'task':/memoria/.test(norm)?'memory':/lembrete/.test(norm)?'reminder':null;return {action:'query',filter:{type,today:/hoje/.test(norm),status:type==='memory'?null:'pending'}};}
 const correction=/^(nao[, ]|corrig[ae]|mude|altere|na verdade)/.test(norm);
 let items,action='create',t;
 if(correction&&!pending){if(!lastItem)return {action:'help',reply:'Qual item você quer corrigir? Abra-o em Vida para editar.'};action='correct';const prev=lastItem.dueAt?localParts(new Date(lastItem.dueAt),timezone):null;t=temporal(input,now,timezone,prev?{date:[prev.year,prev.month,prev.day],hour:prev.hour,minute:prev.minute}:null);if(!t.hasDate&&!t.hasTime)return {action:'help',reply:'Para corrigir a data, diga por exemplo “Não, sábado às 10”. Você também pode editar em Vida.'};items=[{...lastItem}];}
 else if(pending){items=pending.items;action=pending.action||'create';t=temporal(input,now,timezone,pending.temporal);if(!t.hasDate&&!t.hasTime)return {action:'clarify',reply:pending.reply,pending};}
 else{
 const memory=/^(guarde(?: que)?|lembre que|memorize|minha memoria[: ]|memoria[: ])/i.test(norm),reminder=/^(me lembr[ae]|lembrete|lembrar de)/.test(norm),task=/^(preciso|tenho que|tarefa)/.test(norm),event=/^(tenho |agend[ae] |marc[ae] |compromisso |reuniao |consulta )/.test(norm);
 if(!memory&&!reminder&&!task&&!event)return {action:'help',reply:'Estou no modo local. Posso organizar tarefas, compromissos, lembretes e memórias. Diga “Preciso comprar pão”, “Tenho dentista quinta às 10” ou “Minhas tarefas”.'};
 const type=memory?'memory':reminder?'reminder':task?'task':'event';t=temporal(input,now,timezone);
 const segments=input.split(/\s+e\s+preciso\s+/i);let title=segments[0];
 if(memory)title=title.replace(/^(guarde(?: que)?|lembre que|memorize|minha mem[oó]ria[: ]|mem[oó]ria[: ])\s*/i,'');
 else if(reminder){const m=title.match(/\s+de\s+(.+)$/i);title=m?m[1]:title.replace(/^(me lembr[ae]|lembrete[: ]?|lembrar de)\s*/i,'');}
 else title=title.replace(/^(tenho que|preciso|tenho|agend[ae]|marc[ae]|tarefa[: ]?|compromisso[: ]?)\s*/i,'');
 if(!memory){title=title.replace(/\s+(?:na\s+|no\s+)?(?:domingo|segunda|terça|terca|quarta|quinta|sexta|s[aá]bado|hoje|amanhã|amanha|depois de amanhã|\d{1,2}\/\d{1,2})[\s\S]*$/i,'').replace(/\s+[àa]s\s+\d[\s\S]*$/i,'');}
 items=[{type,title:cap(title),dueAt:null,source:input}];if(segments[1]&&!memory)items.push({type:'task',title:cap(segments[1]),dueAt:null,source:input});
 if(memory)return {action:'create',items};
 }
 const dated=items[0].type==='event'||items[0].type==='reminder'||t.hasDate||t.hasTime||pending;
 if(!items[0].title)return {action:'help',reply:'O que você quer registrar?'};
 const question=t.error||(!t.date&&dated?'Em qual data? Diga o dia da semana ou dia/mês/ano.':t.hour===null&&dated?'Em qual horário?':null);
 if(question)return {action:'clarify',reply:question,pending:{items,action,temporal:{date:t.date,hour:t.hour,minute:t.minute},reply:question}};
 const dueAt=dated?zonedISO(...t.date,t.hour,t.minute,timezone):null;
 if(dated){const target=localParts(new Date(dueAt),timezone),matches=p=>p.year===t.date[0]&&p.month===t.date[1]&&p.day===t.date[2]&&p.hour===t.hour&&p.minute===t.minute;const ambiguous=[-3600000,3600000].some(delta=>matches(localParts(new Date(Date.parse(dueAt)+delta),timezone)));if(!matches(target)||ambiguous){const reply='Esse horário não existe ou se repete na mudança de horário de verão. Qual outro horário você prefere?';return {action:'clarify',reply,pending:{items,action,temporal:{date:t.date,hour:null,minute:0},reply}};}}
 if(action==='correct')return {action,patch:{dueAt}};
 return {action:'create',items:items.map(i=>({...i,dueAt}))};
}
