import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2 } from 'lucide-react';
import { browserVoiceDependencies, createVoiceController } from './voice.js';

const ACTIVE = new Set(['requesting', 'recording', 'stopping', 'transcribing']);
export function VoiceRecorder({ busy, onLockedChange, onTranscript }) {
  const controller = useRef(null);
  const callbacks = useRef({ onLockedChange, onTranscript });
  callbacks.current = { onLockedChange, onTranscript };
  const [state, setState] = useState({ status: 'idle', elapsed: 0, url: '', blob: null, error: '' });
  const [capability, setCapability] = useState(null);
  const [capabilityError, setCapabilityError] = useState('');
  const [environmentError, setEnvironmentError] = useState('');
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState('');
  const [refresh, setRefresh] = useState(0);
  const attempted = useRef(false);

  useEffect(() => {
    const deps = browserVoiceDependencies();
    if (!deps.secure) setEnvironmentError('Microfone requer HTTPS. Abra a Mentra por uma conexão segura ou use o teclado.');
    else if (!deps.MediaRecorder || !deps.getUserMedia) setEnvironmentError('Gravação indisponível neste navegador. Atualize o navegador ou use o teclado.');
    const instance = createVoiceController(deps);
    controller.current = instance;
    const unsubscribe = instance.subscribe(next => {
      setState(next);
      callbacks.current.onLockedChange?.(ACTIVE.has(next.status));
    });
    return () => { unsubscribe(); instance.dispose(); controller.current = null; callbacks.current.onLockedChange?.(false); };
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    setCapabilityError('');
    fetch('/api/voice/capabilities', { credentials: 'same-origin', signal: abort.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível verificar a transcrição externa.');
        if (typeof data.configured !== 'boolean' || !Array.isArray(data.formats) || !(data.maxBytes > 0) || !(data.maxDurationSeconds > 0)) throw new Error('Configuração de voz inválida. Use o teclado.');
        if (!abort.signal.aborted) setCapability(data);
      })
      .catch(error => { if (!abort.signal.aborted) setCapabilityError(error.message || 'Falha de conexão. Use o teclado.'); });
    return () => abort.abort();
  }, [refresh]);

  const provider = capability?.provider === 'brainiall' ? 'BRAINIALL' : capability?.provider === 'openai' ? 'OpenAI' : 'o provedor configurado no servidor';
  const unavailable = environmentError || capabilityError || (!capability ? 'Verificando disponibilidade da transcrição externa…' : !capability.configured ? 'Transcrição externa não configurada no servidor. É necessária uma chave e créditos do provedor. Use o teclado.' : '');
  const active = ACTIVE.has(state.status);
  function discard() { controller.current?.cancel(); attempted.current = false; setReview(''); setNotice('Áudio descartado.'); }
  async function transcribe() {
    if (!consent || busy || !capability?.configured) return;
    if (attempted.current && !window.confirm('Tentar transcrever novamente pode gerar nova cobrança, mesmo se a tentativa anterior terminou por tempo limite. Continuar?')) return;
    attempted.current = true; setNotice('');
    const text = await controller.current?.transcribe(capability);
    if (!text || !controller.current) return;
    useText(text);
  }
  function useText(text) {
    if (callbacks.current.onTranscript?.(text) === false) {
      setReview(text); setNotice('O rascunho e a transcrição ultrapassam 2.000 caracteres. Edite os textos antes de usar; nada foi cortado.');
      return;
    }
    controller.current?.cancel(); attempted.current = false; setReview('');
    setNotice('Transcrição pronta. Revise e edite a mensagem antes de enviar. Nada foi salvo.');
  }

  return <section className="voice-recorder" aria-label="Gravação de áudio">
    <p className="voice-disclosure">Grave até {Math.min(capability?.maxDurationSeconds || 120, 120)} segundos. O áudio fica somente na memória desta página; não é guardado pela Mentra. Ao escolher “Transcrever áudio”, ele é enviado a {provider} para processamento externo, que pode usar créditos pagos. Nada é salvo antes de você revisar e enviar a mensagem.</p>
    <label className="voice-consent"><input type="checkbox" checked={consent} disabled={active || busy} onChange={e => setConsent(e.target.checked)} />Autorizo o microfone e a transcrição externa</label>
    {unavailable && <p className="voice-status" role="status">{unavailable}</p>}
    {capabilityError && <button type="button" className="text-button" disabled={busy || active} onClick={() => setRefresh(n => n + 1)}>Verificar disponibilidade novamente</button>}
    <div className="voice-actions">
      {!state.blob && !active && <button type="button" className="secondary" disabled={busy || !consent || !!unavailable} onClick={() => { setNotice(''); attempted.current = false; controller.current?.start(capability); }}><Mic size={17} />Gravar áudio</button>}
      {state.status === 'requesting' && <span role="status">Aguardando permissão do microfone…</span>}
      {state.status === 'recording' && <><span className="voice-elapsed" role="timer" aria-label="Tempo de gravação">Gravando · {state.elapsed}s</span><button type="button" className="secondary recording" onClick={() => controller.current?.stop()}><Square size={16} />Parar gravação</button></>}
      {state.status === 'stopping' && <span role="status">Finalizando gravação…</span>}
      {(active || state.blob) && <button type="button" className="text-button" onClick={discard}><Trash2 size={16} />Descartar áudio</button>}
    </div>
    {state.url && <audio key={state.url} src={state.url} controls preload="metadata" aria-label="Ouvir gravação" />}
    {state.blob && <div className="voice-actions"><button type="button" className="secondary" disabled={busy || active || !consent || !capability?.configured || !!review} onClick={transcribe}>Transcrever áudio</button>{state.status === 'transcribing' && <span role="status">Transcrevendo externamente…</span>}</div>}
    {attempted.current && state.status === 'error' && state.blob && <p className="voice-status">Seu áudio foi mantido. Uma nova tentativa pode gerar nova cobrança; não repetimos o envio automaticamente.</p>}
    {review && <div className="voice-review"><label>Transcrição para revisão<textarea aria-label="Transcrição para revisão" value={review} maxLength={2000} onChange={e => setReview(e.target.value)} /></label><button type="button" className="secondary" disabled={busy || !review.trim()} onClick={() => useText(review)}>Usar texto na mensagem</button></div>}
    {state.error && <p className="voice-error" role="alert">{state.error}</p>}
    {notice && <p className="voice-status" role="status">{notice}</p>}
  </section>;
}
