import React, { useEffect, useState } from 'react';
import { Download, Smartphone, Check } from 'lucide-react';

let installPrompt = null;
const subscribers = new Set();
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event; subscribers.forEach(update => update(event));
});

export function InstallApp() {
  const [prompt, setPrompt] = useState(installPrompt);
  const [installed, setInstalled] = useState(() => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone));
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const done = () => { setInstalled(true); setPrompt(null); installPrompt = null; };
    subscribers.add(setPrompt);
    window.addEventListener('appinstalled', done);
    return () => { subscribers.delete(setPrompt); window.removeEventListener('appinstalled', done); };
  }, []);
  async function install() {
    if (!prompt) { setHelp(!help); return; }
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch { setHelp(true); }
    setPrompt(null);
    installPrompt = null;
  }
  return <section className="settings-panel install-panel">
    <Smartphone size={24} /><h2>Mentra sempre por perto</h2>
    <p>Abra direto da tela inicial, em uma janela própria. Seus registros continuam vinculados à sua conta.</p>
    {installed ? <p className="installed-note"><Check size={18} /> Você está usando a Mentra como app.</p> : <button className="ghost" onClick={install}><Download size={17} /> Adicionar à tela inicial</button>}
    {help && <div className="install-help" role="status"><strong>No celular</strong><p>No iPhone, abra no Safari e toque em Compartilhar → Adicionar à Tela de Início. No Android, use o menu do navegador → Instalar app ou Adicionar à tela inicial.</p><strong>No computador</strong><p>Use a opção de instalar aplicativo na barra de endereço ou no menu do Chrome ou Edge. A opção depende do navegador.</p></div>}
    <small className="muted">É preciso estar conectado à internet para consultar e salvar registros.</small>
  </section>;
}
