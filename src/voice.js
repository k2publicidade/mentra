export function mergeTranscript(draft, transcript) {
  const text = transcript.trim();
  if (!text) return draft;
  if (draft === text || draft.endsWith(` ${text}`)) return draft;
  const merged = `${draft}${draft && !/\s$/.test(draft) ? ' ' : ''}${text}`;
  return merged.length <= 2000 ? merged : null;
}

export function browserVoiceDependencies() {
  return {
    secure: globalThis.isSecureContext === true,
    MediaRecorder: globalThis.MediaRecorder,
    preferMp4: /Safari/i.test(globalThis.navigator?.userAgent || '') && !/Chrome|Chromium|CriOS|Edg|Android|OPR/i.test(globalThis.navigator?.userAgent || ''),
    getUserMedia: globalThis.navigator?.mediaDevices?.getUserMedia?.bind(globalThis.navigator.mediaDevices),
    createObjectURL: blob => URL.createObjectURL(blob), revokeObjectURL: url => URL.revokeObjectURL(url),
    setInterval: globalThis.setInterval.bind(globalThis), clearInterval: globalThis.clearInterval.bind(globalThis),
    now: () => Date.now(), fetcher: (...args) => globalThis.fetch(...args),
    document: globalThis.document, window: globalThis.window,
  };
}

const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm'];
export function createVoiceController(deps) {
  let snapshot = { status: 'idle', blob: null, url: '', elapsed: 0, error: '' };
  let generation = 0, disposed = false, stream, recorder, timer, upload, chunks = [], cleanup = [];
  function listen(target, event, handler) {
    target?.addEventListener(event, handler);
    cleanup.push(() => target?.removeEventListener(event, handler));
  }
  function interrupt() {
    if (snapshot.status === 'requesting') { fail('Gravação interrompida. Volte à página e tente novamente.'); return; }
    if (snapshot.status === 'recording') { emit({ error: 'Gravação interrompida. Ouça o áudio antes de transcrever.' }); stop(); }
  }
  const listeners = new Set();
  const emit = patch => { snapshot = { ...snapshot, ...patch }; if (!disposed) listeners.forEach(fn => fn(snapshot)); };
  function release() {
    cleanup.forEach(fn => fn()); cleanup = [];
    if (timer !== undefined) deps.clearInterval(timer);
    timer = undefined;
    stream?.getTracks().forEach(track => track.stop()); stream = undefined;
  }
  function cancel() {
    generation++;
    upload?.abort(); upload = undefined;
    if (recorder) { recorder.ondataavailable = recorder.onstop = recorder.onerror = null; if (recorder.state !== 'inactive') recorder.stop(); }
    recorder = undefined; release(); chunks = [];
    if (snapshot.url) deps.revokeObjectURL(snapshot.url);
    emit({ status: 'idle', blob: null, url: '', elapsed: 0, error: '' });
  }
  function fail(error) { cancel(); emit({ status: 'error', error }); }
  function stop() { if (recorder?.state === 'recording') { emit({ status: 'stopping' }); recorder.stop(); release(); } }
  return {
    getSnapshot: () => snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async start(capabilities) {
      cancel(); const id = generation;
      if (disposed) return;
      if (!deps.secure) { fail('Microfone requer HTTPS. Abra a Mentra por uma conexão segura ou use o teclado.'); return; }
      if (!deps.MediaRecorder || !deps.getUserMedia) { fail('Gravação indisponível neste navegador. Atualize o navegador ou use o teclado.'); return; }
      if (!capabilities?.configured) { fail('Transcrição externa não configurada no servidor. Use o teclado.'); return; }
      emit({ status: 'requesting' });
      listen(deps.document, 'visibilitychange', () => { if (deps.document.hidden) interrupt(); });
      listen(deps.window, 'pagehide', interrupt);
      let received;
      try { received = await deps.getUserMedia({ audio: true }); }
      catch (error) {
        if (id === generation && !disposed) fail(error.name === 'NotAllowedError' ? 'Microfone não autorizado. Altere a permissão do navegador ou digite.' : 'Não foi possível acessar o microfone. Verifique o dispositivo ou digite.');
        return;
      }
      if (disposed || id !== generation) { received.getTracks().forEach(track => track.stop()); return; }
      stream = received;
      stream.getTracks().forEach(track => listen(track, 'ended', interrupt));
      try {
      const types = deps.preferMp4 ? [...MIME_TYPES.filter(type => type.startsWith('audio/mp4')), ...MIME_TYPES.filter(type => !type.startsWith('audio/mp4'))] : MIME_TYPES;
      const mimeType = types.find(type => capabilities.formats.includes(type.split(';')[0]) && deps.MediaRecorder.isTypeSupported(type));
      recorder = new deps.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const actualType = recorder.mimeType;
      if (!capabilities.formats.includes(actualType.split(';')[0]) || !['audio/webm', 'audio/mp4', 'audio/wav', 'audio/mpeg'].includes(actualType.split(';')[0])) {
        fail('O formato de áudio deste navegador não é aceito pelo provedor. Use outro navegador ou digite.'); return;
      }
      recorder.onerror = () => { if (id === generation && !disposed) fail('A gravação falhou. Verifique o microfone e grave novamente ou digite.'); };
      let bytes = 0;
      const maxBytes = Math.min(capabilities.maxBytes, 10485760);
      const maxDuration = Math.min(capabilities.maxDurationSeconds, 120);
      const started = deps.now();
      recorder.ondataavailable = event => {
        if (id !== generation || disposed) return;
        bytes += event.data.size;
        if (bytes > maxBytes) { fail('Áudio excedeu o limite de tamanho. Grave uma mensagem mais curta.'); return; }
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (id !== generation || disposed) return;
        release(); const blob = new Blob(chunks, { type: actualType }); chunks = [];
        if (!blob.size) { fail('A gravação ficou vazia. Grave novamente ou digite.'); return; }
        try { emit({ status: 'recorded', blob, url: deps.createObjectURL(blob) }); }
        catch { fail('Não foi possível preparar a reprodução do áudio. Grave novamente ou digite.'); }
      };
      recorder.start(250); timer = deps.setInterval(() => {
        const elapsed = Math.min(maxDuration, Math.floor((deps.now() - started) / 1000));
        emit({ elapsed });
        if (elapsed >= maxDuration) stop();
      }, 250);
      emit({ status: 'recording' });
      } catch { fail('Não foi possível iniciar a gravação. Verifique o microfone ou digite.'); }
    },
    async transcribe(capabilities) {
      if (disposed || !snapshot.blob || snapshot.status === 'transcribing') return;
      if (!capabilities?.configured) { emit({ status: 'error', error: 'Transcrição externa não configurada no servidor. Use o teclado.' }); return; }
      const id = generation;
      const controller = new AbortController(); upload = controller;
      emit({ status: 'transcribing', error: '' });
      try {
        const response = await deps.fetcher('/api/voice/transcribe', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': snapshot.blob.type }, body: snapshot.blob, signal: controller.signal });
        const data = await response.json();
        if (disposed || id !== generation) return;
        if (!response.ok) throw new Error(data.error || (response.status === 401 ? 'Sua sessão expirou. Entre novamente.' : 'Não foi possível transcrever. Tente novamente.'));
        if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 2000) throw new Error('Não recebemos um texto válido. Grave uma mensagem mais curta ou digite.');
        emit({ status: 'recorded', error: '' });
        return data.text.trim();
      } catch (error) {
        if (!disposed && id === generation) {
          const message = error instanceof TypeError ? 'Falha de conexão. Seu áudio foi mantido para tentar novamente.' : error instanceof SyntaxError ? 'A resposta do servidor não pôde ser confirmada. Seu áudio foi mantido.' : error.message || 'Não foi possível transcrever. Seu áudio foi mantido.';
          emit({ status: 'error', error: message });
        }
      } finally { if (upload === controller) upload = undefined; }
    },
    stop, cancel,
    dispose() { disposed = true; listeners.clear(); cancel(); },
  };
}
