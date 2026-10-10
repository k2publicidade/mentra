# Verificação executada — MENTRA LIFE

## Coleção de imagens 3D — 10/10/2026

Três ilustrações originais geradas com `image_gen`: equilíbrio/folha, agenda e conversa, em verde sálvia e marfim, acabamento fosco e transparência real. Mestres e prompts em `design/3d`; versões responsivas WebP 320/640 e fallback PNG em `public/artwork`. WebP 320 tem 11,5–14,7 KB por arquivo, e 640 tem 28,8–35,8 KB. Alfa dos três mestres confirmado durante preparação com Sharp.

Entrada recebe a composição de equilíbrio; Vida sem registros reutiliza a imagem; a agenda vazia recebe o calendário e a conversa inicial recebe os balões. O componente reserva proporção/dimensões, decodifica de forma assíncrona, carrega sob demanda e usa prioridade baixa. Imagens são decorativas, com alt vazio e aria-hidden; textos e botões permanecem acessíveis e fora das imagens.

Build passou e os sete testes de núcleo/experiência passaram após integração. Capturas `artwork-auth-desktop.png`, `artwork-auth-mobile.png`, `artwork-agenda-mobile.png` e `ux-chat-mobile.png` revisadas visualmente. Verificação do carregamento real dos arquivos incluída nas capturas; quatro telas continuam sem transbordamento de 320 a 1440 pixels. Também corrigido espaço entre linhas do título público quando as quebras são ocultas no celular.

## Experiência de app e organização — 10/10/2026

Revisão das quatro telas com tipografia maior, cartões, navegação inferior, áreas seguras do celular, formulário em painel inferior, ações fixas e adaptação à altura visível do teclado. Hoje oferece agenda por dia/semana, números derivados dos registros, prioridades, revisão de datas anteriores e lista sem data. Vida combina busca sem acentos, filtros e ordenação. Filtros e rascunho permanecem ao trocar de tela, e são limpos ao sair da conta. Histórico do navegador acompanha as abas.

- `npm test`: 93/93 passaram; build de produção passou. Testes de utilitários cobrem fuso da conta, limites de mês/ano, combinação de filtros, ordenação e exclusão de memórias/concluídos das pendências.
- `npm run test:e2e`: 8/8 passaram; os dois testes de experiência foram repetidos após os ajustes finais e passaram. `npm run test:voice`: 2/2 passaram.
- Jornada Chromium: criação com atalho de data, persistência real, desfazer, agenda por dia, filtros e rascunho entre abas, voltar do navegador, orientação de instalação, proteção de alterações não salvas, foco preso no modal e conteúdo de fundo inert.
- Quatro telas verificadas em 320, 390, 768 e 1440 pixels, sem transbordamento horizontal. Screenshots de Hoje, Vida, Mentra, Eu e edição revisadas em `test-results/ux-*.png`.
- Manifesto standalone, ícones 192/512 e Apple 180, atalhos para Mentra/Vida e orientação de instalação em Eu. Service worker guarda apenas `/offline.html`; navegação sem conexão mostrou a página pública e retomou login quando a rede voltou. Rotas `/api` não são interceptadas nem armazenadas.
- Voz continua opcional e exige abrir o painel, autorizar microfone/processamento externo e revisar antes de enviar. Os dois testes com microfone sintético e fornecedor local passaram.
- Produção Vercel: commit `994e322`, deployment `7LrpSp1uspkx7i4YWpdzjfXTZtjt` confirmado Ready e Latest no domínio oficial. HTML serviu o bundle novo, manifesto, service worker, página offline e ícones retornaram HTTP 200 com tipos corretos; `/api/health` confirmou Supabase.
- A mesma jornada de experiência rodou contra `https://mentra-tawny.vercel.app` com Supabase real: 1/1 passou em 21,8s, incluindo registros persistidos, desfazer, filtros, rascunho, histórico, instalação, quatro larguras e modal. A conta descartável foi removida em `finally` com resposta de sucesso. Evidência do painel em `test-results/online/vercel-ux.png`; screenshots `ux-*` dessa última jornada mostram a versão publicada.

Esta rodada verifica web responsiva em Chromium e comportamento de instalação/serviço offline; não equivale a testes em aparelhos físicos iPhone/Android. Sem internet não há gravação de registros; o rascunho é mantido durante a sessão da página, sem persistência após recarga. A transcrição paga real continua dependendo da chave do fornecedor.

## Verificação online — 10/10/2026

Produção: https://mentra-tawny.vercel.app. Deploy Vercel com segredos de produção e certificado CA oficial do Supabase. Site URL corrigida para a origem HTTPS oficial. Confirmação de e-mail temporariamente desativada por solicitação expressa do usuário; SMTP próprio não configurado.

- `npm test`: 89/89 passaram; quatro falhas de diretório temporário no Windows corrigidas com `node:os.tmpdir()`.
- `npm run build`: passou.
- `npm run test:e2e`: 6/6 passaram em Chromium local.
- `npx playwright test --config playwright.online.config.js`: 1/1 passou com fixture de confirmação de e-mail.
- PostgreSQL remoto: TLS com validação de certificado passou; seis tabelas/RLS, políticas, triggers, prioridade CHECK/UNIQUE e permissões das funções verificadas. A definição da migração de timestamps já estava aplicada.
- `/api/health` público: HTTP 200, `{ "ok": true, "storage": "supabase" }`. Rotas protegidas sem sessão retornaram HTTP 401 JSON.
- `node scripts/verify-online.js --allow-test-accounts`: passou no deploy real, com Supabase Auth e PostgreSQL reais. Duas contas de teste únicas foram removidas pelo endpoint de exclusão de conta ao final.
- Fluxos remotos: cadastro imediato, cookie Secure/HttpOnly sem tokens no JSON, quatro tipos de itens, edição, desfazer encadeado, isolamento entre contas, chat/esclarecimento/correção/desfazer, concorrência de replay idempotente, três prioridades sob quatro gravações concorrentes, merge de preferências concorrentes, resumo, exportação JSON, ICS, data inválida rejeitada, logout, login real e persistência após nova sessão.

Voz: capabilities remoto retornou `configured: false`, `provider: brainiall`; o usuário informou que adicionará BRAINIALL_API_KEY. A chamada paga real e a validação em aparelhos dependem dessa configuração. Entrega de e-mail não foi testada, pois confirmação está desativada. Recuperação de senha, IA generativa, WhatsApp, cobrança e notificações de servidor continuam fora da implementação atual.

As seções abaixo são registros históricos e não substituem esta rodada online.

Atualização de compatibilidade da voz na Vercel: backend online e capabilities limitam áudio a 4.000.000 bytes; frontend já respeita capabilities. Testes de rejeição acima do limite antes da chamada ao fornecedor e de upload pequeno passaram. 31 testes relacionados a voz, frontend e configuração Vercel passaram nesta rodada. Chave BRAINIALL ainda necessária para validação paga real.

## Resultado inicial do núcleo local

As evidências abaixo registram a rodada anterior à implementação de gravação real; a atualização de voz aparece ao final.

npm run build: PASSOU (Vite 7.3.7, 1581 módulos).
npm test: 26 testes, 26 passaram, 0 falhas.
npm run test:e2e: 5 testes Playwright/Chromium, 5 passaram, 0 falhas.
npm audit: 0 vulnerabilidades reportadas no momento da execução; isso não substitui auditoria de segurança.

Servidor local iniciado por npm start e lido novamente:
GET http://127.0.0.1:3000/api/health -> {"ok":true}
GET http://127.0.0.1:3000/ -> HTTP 200, text/html, raiz da aplicação presente.

## Fluxos exercitados

- Cadastro no navegador e onboarding com a captura do exemplo do PDF.
- Consulta com evento Dentista + tarefa Levar os exames, persistidos.
- Edição pelo formulário, desfazer, recarga, conclusão e novo login preservando dados.
- Perfil editado e preferência salva.
- Memória criada manualmente com origem visível; exclusão refletida na API.
- Falha HTTP controlada na criação não mostrou sucesso, manteve erro dentro do formulário e não criou item; repetição posterior funcionou.
- Isolamento: conta B não consultou, editou, excluiu ou desfez itens da conta A.
- Lembrete com horário ausente pediu esclarecimento, sem criação prematura; resposta às 14 criou objeto.
- Correção 'Não, sábado.' atualizou o mesmo identificador sem duplicar; desfazer restaurou data.
- requestId repetido não duplicou captura/mensagens.
- Exportação JSON e calendário ICS autenticados.
- Exclusão integral de conta, inclusive registros auxiliares, e sessão invalidada.
- Testes de transação simularam falha de persistência, comprovando rollback sem confirmação falsa.
- Banco e conversa pendente sobreviveram reabertura real do SQLite.
- Datas inválidas, CSRF/origem cruzada, prioridades acima de 3 e campos indevidos foram rejeitados.
- Bootstrap padrão em loopback e configuração explícita HOST verificados em processos reais.
- Layout móvel 390x844 sem transbordamento horizontal e desktop 1440x1000.
- Nenhuma exceção JavaScript de página na jornada de navegador testada.

Screenshots revisadas visualmente:
test-results/vida-mobile.png
test-results/vida-desktop.png

Correção de regressão: confirmação flutuante cobria botão de salvar do modal. Ajuste de empilhamento foi aplicado e jornada passou sem clique forçado. A confirmação móvel ainda ocupa uma faixa temporária da lista e pode ser fechada; não houve auditoria independente WCAG.

## Não verificado / não entregue como ativo

Voz real e entrega de notificações do sistema operacional; sincronização externa; IA externa; cobrança/Premium; WhatsApp; publicação pública; Docker build/runtime; apps nativos; recursos das fases futuras; revisão jurídica/LGPD; auditoria independente de segurança; restauração operacional de backup; carga/escala/custos.

Consulte SCOPE_AND_ACCEPTANCE.md e README.md. Resultado aprovado aqui é o núcleo LOCAL testado, não '100% do produto publicado'.

## Atualização de gravação real / rodada antes da revisão de push

npm test: 56 passaram, 0 falhas (inclui autenticação de upload, contratos locais BRAINIALL/OpenAI, limites, cancelamento e controller do gravador).
npm run build: passou, 1583 módulos.
npm run test:e2e: 5 passaram.
npm run test:voice: 2 passaram após correções de receiver dos timers nativos e CSP media-src self/blob.
HTTPS local com CA verificada e cookie Secure: passou; a CA não foi instalada automaticamente no computador ou celulares.

Playwright/Chromium gravou bytes reais de dispositivo de microfone SINTÉTICO, reproduziu metadados do áudio e enviou multipart a fornecedor HTTP LOCAL de teste. O texto do fornecedor é uma fixture explícita, não resultado de reconhecimento real. Revisão precedeu persistência e falha de fornecedor manteve áudio sem criar tarefa.

Não foram utilizados chave/saldo reais de BRAINIALL/OpenAI nem aparelhos físicos Android/iPhone. Isso segue pendente. O catálogo público usado é descoberta de API, não garantia de qualidade ou serviço gratuito.

Revisão pré-push identificou regressões de senha com espaços e horário manual ambíguo de verão. Ambas foram corrigidas com testes RED/GREEN. Rodada final após correções: npm test 68/68, build passou, navegador núcleo 5/5, navegador voz 2/2, npm audit 0 vulnerabilidades reportadas. A revisão não equivale a auditoria independente completa de segurança ou prova de ausência de bugs.
