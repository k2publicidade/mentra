import test from 'node:test';
import assert from 'node:assert/strict';

const capabilities = { configured: true, maxBytes: 10485760, maxDurationSeconds: 120, formats: ['audio/webm', 'audio/mp4'] };
function harness(overrides = {}) {
  let resolvePermission;
  const stopped = [];
  const track = Object.assign(new EventTarget(), { stop: () => stopped.push(true) });
  const stream = { getTracks: () => [track] };
  const timers = new Map();
  const revoked = [];
  let recorder;
  class Recorder {
    static isTypeSupported(type) { return type.startsWith('audio/webm'); }
    constructor(input, options) { this.mimeType = options?.mimeType || 'audio/mp4'; recorder = this; this.state = 'inactive'; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) }); this.onstop?.(); }
  }
  const deps = { secure: true, getUserMedia: () => new Promise(resolve => { resolvePermission = resolve; }), MediaRecorder: Recorder, createObjectURL: () => 'blob:preview', revokeObjectURL: url => revoked.push(url), setInterval: fn => { timers.set(1, fn); return 1; }, clearInterval: id => timers.delete(id), now: () => 0, ...overrides };
  return { deps, stream, stopped, timers, revoked, allow: () => resolvePermission(stream), recorder: () => recorder };
}

test('recording selects supported MIME, previews real bytes and releases all resources', async () => {
  const { createVoiceController } = await import('../src/voice.js');
  for (const safari of [false, true]) {
    const h = harness();
    if (safari) h.deps.MediaRecorder.isTypeSupported = type => type.startsWith('audio/mp4');
    const c = createVoiceController(h.deps);
    const pending = c.start(capabilities); h.allow(); await pending;
    assert.equal(c.getSnapshot().status, 'recording');
    assert.match(h.recorder().mimeType, safari ? /^audio\/mp4/ : /^audio\/webm/);
    c.stop();
    assert.equal(c.getSnapshot().status, 'recorded');
    assert.equal(await c.getSnapshot().blob.text(), 'audio');
    assert.equal(c.getSnapshot().url, 'blob:preview');
    assert.equal(h.stopped.length, 1);
    assert.equal(h.timers.size, 0);
    c.dispose(); assert.deepEqual(h.revoked, ['blob:preview']);
  }
});

test('recording bounds duration and size and reports denied permissions without leaks', async () => {
  const { createVoiceController } = await import('../src/voice.js');
  let now = 0;
  const h = harness({ now: () => now });
  const c = createVoiceController(h.deps);
  let pending = c.start(capabilities); h.allow(); await pending;
  now = 120000; h.timers.get(1)();
  assert.equal(c.getSnapshot().status, 'recorded');
  assert.equal(c.getSnapshot().elapsed, 120);
  c.cancel(); pending = c.start({ ...capabilities, maxBytes: 2 }); h.allow(); await pending;
  h.recorder().ondataavailable({ data: new Blob(['too big']) });
  assert.equal(c.getSnapshot().status, 'error');
  assert.equal(c.getSnapshot().blob, null);
  assert.equal(h.timers.size, 0);
  const denied = createVoiceController(harness({ getUserMedia: async () => { throw Object.assign(new Error(), { name: 'NotAllowedError' }); } }).deps);
  await denied.start(capabilities);
  assert.match(denied.getSnapshot().error, /autorizado/);
});

test('explicit transcription is authenticated binary, retry keeps audio, cancel aborts late text', async () => {
  const { createVoiceController } = await import('../src/voice.js');
  const calls = [];
  const h = harness({ fetcher: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(calls.length === 1 ? { error: 'Conexão indisponível' } : { text: 'Comprar pão', provider: 'openai' }), { status: calls.length === 1 ? 502 : 200 });
  } });
  const c = createVoiceController(h.deps);
  const pending = c.start(capabilities); h.allow(); await pending; c.stop();
  const blob = c.getSnapshot().blob;
  assert.equal(calls.length, 0);
  assert.equal(await c.transcribe(capabilities), undefined);
  assert.equal(c.getSnapshot().status, 'error');
  assert.equal(c.getSnapshot().blob, blob);
  assert.equal(await c.transcribe(capabilities), 'Comprar pão');
  assert.equal(calls[0].url, '/api/voice/transcribe');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.body, blob);
  assert.equal(calls[0].options.headers['Content-Type'], blob.type);
  assert.equal(c.getSnapshot().status, 'recorded');
  let resolve;
  h.deps.fetcher = (_, options) => new Promise(r => { resolve = r; calls.push({ options }); });
  const late = c.transcribe(capabilities); c.cancel();
  assert.equal(calls.at(-1).options.signal.aborted, true);
  resolve(new Response(JSON.stringify({ text: 'late' }))); assert.equal(await late, undefined);
  assert.equal(c.getSnapshot().status, 'idle');
});

test('secure context, unavailable capability and unsupported MIME never request microphone', async () => {
  const { createVoiceController } = await import('../src/voice.js');
  for (const overrides of [{ secure: false }, { MediaRecorder: null }]) {
    const h = harness(overrides); const c = createVoiceController(h.deps);
    await c.start(capabilities); assert.equal(c.getSnapshot().status, 'error');
    assert.equal(h.recorder(), undefined);
  }
  const h = harness(); const c = createVoiceController(h.deps);
  await c.start({ ...capabilities, configured: false });
  assert.match(c.getSnapshot().error, /configurada/);
  h.deps.MediaRecorder.isTypeSupported = () => false;
  const pending = c.start(capabilities); h.allow(); await pending;
  assert.equal(c.getSnapshot().status, 'recording');
  assert.equal(h.recorder().mimeType, 'audio/mp4');
  c.stop(); assert.equal(c.getSnapshot().blob.type, 'audio/mp4');
});

test('device interruption stops recording and clears lifecycle listeners; constructor errors release stream', async () => {
  const { createVoiceController } = await import('../src/voice.js');
  for (const event of ['ended', 'visibilitychange', 'pagehide']) {
    const document = Object.assign(new EventTarget(), { hidden: true });
    const window = new EventTarget();
    const h = harness({ document, window }); const c = createVoiceController(h.deps);
    const pending = c.start(capabilities); h.allow(); await pending;
    (event === 'ended' ? h.stream.getTracks()[0] : event === 'pagehide' ? window : document).dispatchEvent(new Event(event));
    assert.equal(c.getSnapshot().status, 'recorded');
    assert.match(c.getSnapshot().error, /interrompida/);
    assert.equal(h.stopped.length, 1); assert.equal(h.timers.size, 0);
    c.dispose(); document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(c.getSnapshot().status, 'idle');
  }
  const h = harness({ MediaRecorder: class { static isTypeSupported() { return true; } constructor() { throw new Error('device failure'); } } });
  const c = createVoiceController(h.deps); const pending = c.start(capabilities); h.allow(); await pending;
  assert.equal(c.getSnapshot().status, 'error'); assert.equal(h.stopped.length, 1);
});

test('transcript merge preserves drafts, refuses overflow and does not duplicate retries', async () => {
  const { mergeTranscript } = await import('../src/voice.js');
  assert.equal(mergeTranscript('Meu rascunho', 'Comprar pão'), 'Meu rascunho Comprar pão');
  assert.equal(mergeTranscript('Meu rascunho Comprar pão', 'Comprar pão'), 'Meu rascunho Comprar pão');
  assert.equal(mergeTranscript('x'.repeat(1999), 'texto'), null);
  assert.equal(mergeTranscript('', 'Comprar pão'), 'Comprar pão');
});

test('Chat replaces dictation with external consent and review disclosure without premature persistence', async () => {
  const { createServer } = await import('vite');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement } = await import('react');
  const server = await createServer({ server: { middlewareMode: true, hmr: { port: 25000 + process.pid % 30000 } }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { Chat } = await server.ssrLoadModule('/src/screens.jsx');
    let saves = 0;
    const html = renderToStaticMarkup(createElement(Chat, { user: { name: 'Ana', timezone: 'America/Sao_Paulo' }, messages: [], integrations: { ai: 'local' }, onChat: () => saves++, onNavigate() {} }));
    assert.match(html, /Usar áudio/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /processamento externo/);
    assert.match(html, /Mensagem para a Mentra/);
    const {VoiceRecorder} = await server.ssrLoadModule('/src/VoiceRecorder.jsx');
    const recorder = renderToStaticMarkup(createElement(VoiceRecorder, {}));
    assert.match(recorder, /Gravar áudio/);
    assert.match(recorder, /type="checkbox"/);
    assert.match(recorder, /Nada é salvo antes/);
    assert.doesNotMatch(html, /Ditar mensagem|Ditado opcional/);
    assert.equal(saves, 0);
  } finally { await server.close(); }
});

test('recorder errors, empty audio and unsupported actual MIME never leave a preview or live tracks', async () => {
  const { createVoiceController } = await import('../src/voice.js');
  for (const scenario of ['error', 'empty', 'unsupported']) {
    const h = harness();
    if (scenario === 'unsupported') {
      h.deps.MediaRecorder = class {
        static isTypeSupported() { return false; }
        constructor() { this.mimeType = 'audio/ogg'; this.state = 'inactive'; }
      };
    }
    const c = createVoiceController(h.deps);
    const pending = c.start(capabilities); h.allow(); await pending;
    if (scenario === 'error') h.recorder().onerror({ error: new Error('recorder failed') });
    if (scenario === 'empty') { h.recorder().stop = function () { this.state = 'inactive'; this.onstop(); }; c.stop(); }
    assert.equal(c.getSnapshot().status, 'error');
    assert.equal(c.getSnapshot().blob, null); assert.equal(c.getSnapshot().url, '');
    assert.equal(h.stopped.length, 1); assert.equal(h.timers.size, 0);
  }
});

test('network, malformed JSON, blank and oversized transcripts retain audio and report actionable errors', async () => {
  const { createVoiceController } = await import('../src/voice.js');
  const fetchers = [async () => { throw new TypeError('Failed to fetch'); }, async () => new Response('not json'), async () => new Response(JSON.stringify({ text: ' ' })), async () => new Response(JSON.stringify({ text: 'x'.repeat(2001) }))];
  for (const fetcher of fetchers) {
    const h = harness({ fetcher }); const c = createVoiceController(h.deps);
    const pending = c.start(capabilities); h.allow(); await pending; c.stop();
    const blob = c.getSnapshot().blob;
    await c.transcribe(capabilities);
    assert.equal(c.getSnapshot().status, 'error'); assert.equal(c.getSnapshot().blob, blob);
    assert.match(c.getSnapshot().error, /conexão|resposta|texto válido/);
    c.dispose(); assert.deepEqual(h.revoked, ['blob:preview']);
  }
});

test('new permission request supersedes old one and disposed controllers never notify subscribers', async () => {
  const { createVoiceController } = await import('../src/voice.js');
  const permissions = [];
  const h = harness({ getUserMedia: () => new Promise(resolve => permissions.push(resolve)) });
  const c = createVoiceController(h.deps);
  const first = c.start(capabilities); const second = c.start(capabilities);
  let oldStopped = 0;
  permissions[0]({ getTracks: () => [{ stop: () => oldStopped++ }] }); await first;
  assert.equal(oldStopped, 1); assert.equal(c.getSnapshot().status, 'requesting');
  permissions[1](h.stream); await second;
  assert.equal(c.getSnapshot().status, 'recording');
  let notifications = 0;
  c.subscribe(() => notifications++); c.dispose();
  assert.equal(notifications, 0);
  assert.equal(h.stopped.length, 1); assert.equal(h.timers.size, 0);
});

test('Safari prefers mp4 when both containers are supported and uses actual recorder MIME', async () => {
  const { createVoiceController } = await import('../src/voice.js');
  const h = harness({ preferMp4: true }); h.deps.MediaRecorder.isTypeSupported = () => true;
  const c = createVoiceController(h.deps); const pending = c.start(capabilities); h.allow(); await pending;
  assert.match(h.recorder().mimeType, /^audio\/mp4/);
  c.stop(); assert.match(c.getSnapshot().blob.type, /^audio\/mp4/); c.dispose();
});

test('cancel and dispose stop late permission streams without recorder or leaked timers', async () => {
  const { createVoiceController } = await import('../src/voice.js');
  for (const action of ['cancel', 'dispose']) {
    const h = harness();
    const c = createVoiceController(h.deps);
    const pending = c.start(capabilities);
    assert.equal(c.getSnapshot().status, 'requesting');
    c[action](); h.allow(); await pending;
    assert.equal(h.stopped.length, 1);
    assert.equal(h.recorder(), undefined);
    assert.equal(h.timers.size, 0);
  }
});
