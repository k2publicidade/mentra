import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, Heart, Layers, Leaf, Menu, MessageCircle, Plus, ShieldCheck, Sparkles, X} from 'lucide-react';

const signup='/app?cadastro=1';
const features=[
  {icon:CalendarDays,kicker:'HOJE',title:'Seu dia, em perspectiva.',text:'Compromissos, pendências e até três prioridades. Veja o que importa agora, sem perder o que vem depois.',art:'agenda'},
  {icon:MessageCircle,kicker:'MENTRA',title:'Tire da cabeça. Coloque aqui.',text:'Escreva o que precisa lembrar. A conversa ajuda a registrar, consultar e ajustar sua rotina em português.',art:'conversation'},
  {icon:Layers,kicker:'VIDA',title:'Tudo encontra seu lugar.',text:'Tarefas, eventos, lembretes e memórias juntos. Busque, filtre e edite seus registros quando precisar.',art:'balance'},
];
const questions=[
  ['O que é a Mentra Life?','Um espaço pessoal para organizar tarefas, compromissos, lembretes e memórias. Você pode registrar pela conversa ou pelo formulário e acompanhar tudo no painel.'],
  ['Preciso baixar um aplicativo?','Você pode usar pelo navegador no computador ou celular. No painel, a opção “Adicionar à tela inicial” orienta a instalação como app web. É necessário estar conectado para consultar e salvar seus registros.'],
  ['Como funciona a conversa?','A Mentra interpreta pedidos em português com regras locais. Quando faltar uma informação, ela pode pedir um esclarecimento. Você também pode revisar e editar seus registros manualmente.'],
  ['Posso usar minha agenda em outro calendário?','Sim. O painel oferece exportação em formato .ics para importar em calendários compatíveis. A exportação não é uma sincronização automática entre calendários.'],
  ['Como funciona o plano de R$25?','R$25 por mês é o valor proposto para o plano Essencial de lançamento. Você já pode criar uma conta e conhecer o painel. A contratação e a cobrança ainda não estão disponíveis; criar uma conta não gera cobrança.'],
  ['Tenho controle dos meus registros?','Sim. No painel, você pode editar e excluir registros, exportar seus dados e excluir a conta. As contas têm acesso separado aos seus próprios registros.'],
];

function BrandLink(){return <a className="lp-brand" href="/" aria-label="Mentra Life — início"><span><Leaf size={21}/></span><span>mentra<small>L I F E</small></span></a>}
function Action({children='Criar meu espaço',className='',href=signup}){return <a className={`lp-button ${className}`} href={href}>{children}<ArrowUpRight size={18}/></a>}
function Phone(){return <div className="lp-phone-scene" aria-label="Exemplo ilustrativo do painel Mentra Life">
  <div className="lp-float lp-float-top"><span className="lp-round"><Check size={16}/></span><div>Um pensamento a menos.<small>Lembrete organizado.</small></div></div>
  <div className="lp-phone"><div className="lp-phone-camera"/><div className="lp-phone-status"><b>9:41</b><span>▮▮▮ &nbsp; ◒ &nbsp; ▰</span></div>
    <div className="lp-phone-content"><div className="lp-phone-greeting"><h3>Bom dia,<br/><em>Larissa.</em></h3><span className="lp-avatar">L</span></div><p>Hoje está tudo organizado.</p><div className="lp-phone-rule"/>
      <div className="lp-phone-item"><CalendarDays/><span>Consulta às 10h</span><ChevronDown/></div>
      <div className="lp-phone-item"><Clock3/><span>Reunião às 15h</span><ChevronDown/></div>
      <div className="lp-phone-item"><Heart/><span>Comprar presente da mãe</span><ChevronDown/></div>
      <div className="lp-phone-item"><Check/><span>Enviar os exames</span><ChevronDown/></div>
      <div className="lp-phone-life"><Leaf size={20}/><p>Enquanto isso...</p><strong>Você vive.</strong><span>♡</span><div className="lp-phone-lines"/></div>
      <div className="lp-phone-nav"><CalendarDays/><MessageCircle/><Layers/><span className="lp-avatar">L</span></div>
    </div>
  </div>
  <div className="lp-float lp-float-bottom"><span className="lp-round"><Leaf size={18}/></span><div>Mais espaço para você.<small>Um passo de cada vez.</small></div></div>
  <span className="lp-demo-label">VISUALIZAÇÃO ILUSTRATIVA</span>
</div>}

export default function Landing(){
  const [menu,setMenu]=useState(false); const root=useRef(null);
  useEffect(()=>{
    document.title='Mentra Life — Menos na cabeça. Mais vida.';
    document.documentElement.classList.add('marketing-page');
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.1});
    root.current.querySelectorAll('[data-reveal]').forEach(el=>observer.observe(el));
    return()=>{observer.disconnect();document.documentElement.classList.remove('marketing-page')};
  },[]);
  useEffect(()=>{if(!menu)return;const close=e=>{if(e.key==='Escape')setMenu(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[menu]);
  return <div className="landing" ref={root}>
    <a className="lp-skip" href="#conteudo">Pular para o conteúdo</a>
    <header className="lp-header"><div className="lp-container lp-header-inner"><BrandLink/><nav className={`lp-nav ${menu?'is-open':''}`} id="site-navigation" aria-label="Navegação do site" onClick={()=>setMenu(false)}>
      <a href="#como-funciona">Como funciona</a><a href="#recursos">Recursos</a><a href="#planos">Planos</a><a href="#duvidas">Dúvidas</a><a className="lp-mobile-login" href="/app">Entrar no painel</a>
    </nav><div className="lp-header-actions"><a className="lp-login" href="/app">Entrar <ArrowUpRight size={15}/></a><Action className="lp-header-cta">Começar agora</Action><button className="lp-menu-toggle" aria-label={menu?'Fechar menu':'Abrir menu'} aria-expanded={menu} aria-controls="site-navigation" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div></div></header>
    <main id="conteudo">
      <section className="lp-hero"><picture className="lp-hero-background"><source srcSet="/artwork/hero-morning-960.webp 960w, /artwork/hero-morning-1920.webp 1920w" sizes="100vw"/><img src="/artwork/hero-morning-1920.webp" alt="" width="1920" height="1080" fetchPriority="high"/></picture><div className="lp-container lp-hero-grid">
        <div className="lp-hero-copy"><span className="lp-eyebrow lp-pill"><Sparkles size={13}/> MENOS RUÍDO. MAIS PRESENÇA.</span><h1>Imagine{' '}<br/>acordar <em>assim.</em></h1><p className="lp-hero-description">Seu dia organizado.<br/>Sua mente mais leve. Sua vida acontecendo.</p><p className="lp-hero-support">A Mentra reúne o que você precisa fazer e lembrar em um só lugar. Enquanto isso, você vive.</p><div className="lp-hero-actions"><Action>Criar meu espaço</Action><a className="lp-text-link" href="#como-funciona">Conheça a Mentra <ArrowRight size={17}/></a></div><div className="lp-hero-note"><ShieldCheck size={16}/><span>Seu espaço pessoal. No seu ritmo.</span></div></div>
        <Phone/>
      </div><div className="lp-hero-bottom lp-container"><span>ORGANIZE O ESSENCIAL. VIVA O RESTO.</span><a href="#como-funciona" aria-label="Explore como funciona"><span>Explore</span><ChevronDown size={17}/></a></div></section>
      <div className="lp-benefits"><div className="lp-container"><span><CalendarDays size={17}/> Agenda com clareza</span><span><MessageCircle size={17}/> Captura em português</span><span><Layers size={17}/> Tudo em um só lugar</span><span><Leaf size={17}/> Leveza no cotidiano</span></div></div>

      <section className="lp-section lp-intro lp-container" id="como-funciona" data-reveal><div><span className="lp-eyebrow">A VIDA NÃO PRECISA SER UMA LISTA INFINITA</span><h2>Você não precisa<br/>lembrar de <em>tudo.</em></h2></div><div><p className="lp-large-copy">Entre um compromisso e outro, sempre existe algo ocupando a sua cabeça.</p><p>A Mentra é o lugar para tirar essas pequenas pendências da mente. Organize o que importa, encontre o próximo passo e abra espaço para estar presente.</p><a className="lp-text-link" href="/app">Ver meu painel <ArrowUpRight size={17}/></a></div></section>

      <section className="lp-section lp-features" id="recursos"><div className="lp-container"><div className="lp-section-heading" data-reveal><span className="lp-eyebrow">UM ESPAÇO. SUA VIDA INTEIRA.</span><h2>Clareza para o dia.<br/><em>Leveza para a vida.</em></h2><p>Quatro espaços simples para uma rotina que faz sentido para você.</p></div><div className="lp-feature-grid">{features.map(({icon:Icon,kicker,title,text,art})=><article className="lp-feature" data-reveal key={kicker}><div className="lp-feature-top"><span className="lp-eyebrow"><Icon size={16}/>{kicker}</span><ArrowUpRight size={19}/></div><img src={`/artwork/${art}-320.webp`} alt="" width="320" height="320" loading="lazy"/><h3>{title}</h3><p>{text}</p></article>)}</div><div className="lp-profile-note" data-reveal><span className="lp-round"><ShieldCheck size={23}/></span><div><h3>EU. Do seu jeito.</h3><p>Seu perfil, suas preferências e seus dados. Exporte seus registros e mantenha o controle do seu espaço.</p></div><a href="/app#eu" aria-label="Acessar meu perfil"><ArrowUpRight/></a></div></div></section>

      <section className="lp-section lp-how lp-container"><div className="lp-how-copy" data-reveal><span className="lp-eyebrow">SIMPLES DESDE O PRIMEIRO DIA</span><h2>Um pensamento.<br/>Um registro.<br/><em>Mais espaço.</em></h2><Action>Começar a organizar</Action></div><ol className="lp-steps" data-reveal><li><span>01</span><div><h3>Conte o que precisa lembrar.</h3><p>Escreva na conversa ou adicione pelo formulário. Uma tarefa, um compromisso, uma ideia.</p></div></li><li><span>02</span><div><h3>Dê um lugar ao que importa.</h3><p>Revise o registro, defina a data e escolha suas prioridades. Ajuste sempre que a vida mudar.</p></div></li><li><span>03</span><div><h3>Volte para o seu dia.</h3><p>Consulte a agenda, encontre suas pendências e acompanhe o que já foi concluído.</p></div></li></ol></section>

      <section className="lp-life-band" data-reveal><div className="lp-container"><Leaf size={30}/><span className="lp-eyebrow">ENQUANTO ISSO...</span><h2>Você <em>vive.</em></h2><p>O almoço sem pressa. A conversa sem distração.<br/>O tempo para o que uma lista não consegue medir.</p></div></section>

      <section className="lp-section lp-pricing lp-container" id="planos"><div className="lp-pricing-copy" data-reveal><span className="lp-eyebrow">MAIS CLAREZA CABE NA SUA ROTINA</span><h2>Seu próximo passo,<br/>a partir de <em>R$25.</em></h2><p>Uma proposta simples para manter sua vida organizada. Conheça o espaço antes de dar o próximo passo.</p><div className="lp-pricing-detail"><ShieldCheck size={18}/><span>Criar uma conta não gera cobrança.</span></div></div><article className="lp-plan" data-reveal><div className="lp-plan-top"><span className="lp-eyebrow">ESSENCIAL</span><span className="lp-plan-badge">Plano de lançamento</span></div><p className="lp-plan-tagline">O essencial para estar mais presente.</p><div className="lp-price"><span>R$</span><strong>25</strong><span>/mês</span></div><p className="lp-price-caption">Valor proposto para a assinatura mensal.</p><ul>{['Agenda por dia e semana','Tarefas, eventos, lembretes e memórias','Conversa em português para organizar registros','Busca, filtros e até três prioridades','Exportação de dados e calendário','Acesso pelo computador e celular'].map(x=><li key={x}><Check size={17}/>{x}</li>)}</ul><Action>Criar minha conta</Action><p className="lp-plan-disclosure">O painel já está disponível para cadastro. Contratação e cobrança ainda não disponíveis.</p></article></section>

      <section className="lp-section lp-faq lp-container" id="duvidas"><div data-reveal><span className="lp-eyebrow">SEM PONTAS SOLTAS</span><h2>Antes de<br/><em>começar.</em></h2><p>Respostas simples para conhecer seu novo espaço.</p></div><div className="lp-questions" data-reveal>{questions.map(([q,a])=><details key={q}><summary>{q}<Plus size={18}/></summary><p>{a}</p></details>)}</div></section>

      <section className="lp-final lp-container" data-reveal><span className="lp-eyebrow">MENOS NA CABEÇA. MAIS VIDA.</span><h2>O seu dia pode<br/>começar <em>mais leve.</em></h2><Action>Criar meu espaço</Action><span className="lp-final-note">Já tem uma conta? <a href="/app">Entre no seu painel <ArrowUpRight size={14}/></a></span></section>
      <section className="lp-privacy lp-container" id="privacidade"><ShieldCheck size={20}/><div><h3>Seu espaço merece cuidado.</h3><p>Seus registros ficam vinculados à sua conta. No painel, você pode exportar seus dados e excluir sua conta. A captura por voz, quando configurada, pede sua permissão e usa um fornecedor externo para transcrição.</p></div></section>
    </main><footer className="lp-footer lp-container"><BrandLink/><p>Um espaço seu. Um passo de cada vez.</p><nav aria-label="Links do rodapé"><a href="#privacidade">Seus dados</a><a href="#duvidas">Dúvidas</a><a href="/app">Acessar painel <ArrowUpRight size={14}/></a></nav><small>© {new Date().getFullYear()} Mentra Life</small></footer>
  </div>
}
