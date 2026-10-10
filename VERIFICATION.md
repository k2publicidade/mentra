# Verificação executada — MENTRA LIFE

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
