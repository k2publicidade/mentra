# MENTRA LIFE

Webapp PT-BR baseado no núcleo inicial de Mentra_Life_Mapa_de_Implementacao.pdf. Este repositório não substitui o PRD Técnico Mestre citado no PDF, nem aprova publicação comercial.

## Publicação online

O backend online de Vercel usa Supabase Auth e PostgreSQL transacional sem migrar nem tocar no SQLite local. Aplicação publicada em https://mentra-tawny.vercel.app. Veja [ONLINE_DEPLOYMENT.md](ONLINE_DEPLOYMENT.md) para configuração e [VERIFICATION.md](VERIFICATION.md) para evidências e pendências. A confirmação de e-mail está temporariamente desativada por solicitação do responsável.

## Experiência móvel e organização

Navegação inferior, atalhos de criação por tipo e formulário em painel inferior com ações fixas no celular. Hoje separa a agenda por dia, pendências anteriores, prioridades e registros sem data; datas seguem o fuso da conta. Vida oferece busca sem acentos, filtros combinados e ordenação por data, título ou criação. Filtros e rascunho da conversa permanecem durante a navegação da sessão; sair da conta os limpa.

Em Eu, use **Adicionar à tela inicial** para instalar a versão web como app. O manifesto inclui atalhos para a conversa e os registros. A instalação não oferece gravação offline nem notificações push: o service worker guarda somente uma página pública de orientação quando não há conexão, e nunca armazena respostas de API ou dados da conta. Ações continuam dependendo da confirmação do servidor.

A coleção de ilustrações 3D usa fundo transparente, cores da identidade e WebP responsivo. Mestres, prompts e detalhes de preparação estão em [design/3d/README.md](design/3d/README.md).

## Rodar localmente

Requisitos: Node.js 24 ou superior e npm.

    npm install
    npm run build
    npm start

Abra http://127.0.0.1:3000 e crie sua própria conta. Não existem contas padrão nem dados de demonstração. Banco de dados SQLite local em data/mentra.sqlite (o caminho definitivo é configurável por DB_PATH). Não exponha essa pasta na web.

Para desenvolver, use dois terminais:

    npm run dev
    npm run dev:ui

O Vite encaminha /api ao backend. A porta da interface aparece na saída do Vite.

## Testes

    npm test
    npx playwright install chromium
    npm run build
    npm run test:e2e

Os testes usam contas próprias e bancos de teste. Não execute testes destrutivos contra um banco de produção. Evidências consolidadas serão registradas em VERIFICATION.md após a execução completa.

## Escopo

Hoje: compromissos, lembretes, até três prioridades, resumo derivado dos seus dados.
Mentra: captura de texto, consulta, esclarecimentos e correção natural com interpretação local em português; confirmação após gravação; desfazer.
Vida: tarefas, eventos, lembretes e memórias editáveis; busca, filtros, conclusão e edição.
Eu: perfil, fuso, preferências, exportação de dados, exclusão da conta, status das integrações.
Contas: cadastro, login, sessão por cookie HttpOnly e isolamento dos dados no servidor.

## Limites importantes

A conversa usa regras locais, não um LLM conectado. Não compreende toda linguagem livre: se necessário, use a criação/edição manual. Não há garantia de extração de intenções arbitrárias. O sistema não executa ações externas de alto risco.

Voz usa gravação real com MediaRecorder e transcrição externa no servidor (BRAINIALL por padrão, selecionada a partir do catálogo solicitado; OpenAI opcional). Requer chave/créditos do fornecedor, HTTPS confiável e permissão de microfone. O áudio só é enviado ao selecionar Transcrever áudio; revise o texto antes de enviar a mensagem para criar registros. Não há promessa de gravação com tela bloqueada. Consulte VOICE_SETUP.md. A integração real do fornecedor e os aparelhos Android/iPhone ainda precisam de validação com sua conta e dispositivos.

Notificações são do navegador e dependem de permissão e da página aberta. Não são push de servidor e não têm garantia de entrega com o navegador fechado. Preferências de resumos não equivalem a agendamento de envio externo.

Calendário oferece exportação .ics, não sincronização bidirecional com Google/Apple/Microsoft. Importações repetidas podem duplicar itens no calendário externo, que não é controlado por este app.

Premium, assinatura/cancelamento por operadora, cobrança, WhatsApp/Mentra Box, login social, recuperação de senha por e-mail e IA externa não estão ativos. Não existem preços aprovados no documento fornecido. Não há apps nativos iOS/Android: esta entrega é web responsiva.

Pessoas/projetos, documentos/imagens, busca semântica, reservas/compras e outras fases futuras do PDF não estão implementados.

## Segurança e publicação

Uso local é diferente de operação pública. Antes de publicar: revisão de segurança/LGPD, HTTPS, domínio, política de retenção, e-mail/recuperação/verificação de conta, monitoramento, backups restauráveis, quotas, custos, suporte e aprovação de Larissa. Não coletar dados sensíveis de usuários reais em um piloto sem base legal e política de privacidade revisadas.

Nunca configure credenciais no frontend (VITE_*). Segredos pertencem ao ambiente do servidor ou ao secret manager da hospedagem. Para uso local, copie .env.example para .env e preencha a chave somente nesse arquivo; npm start e npm run start:mobile carregam o arquivo com --env-file-if-exists. O .env está ignorado pelo Git. Para produção, configure NODE_ENV=production e HTTPS confiável.

O banco local não é criptografado por esta aplicação. Proteja disco, backups e acesso ao computador. Para copiar o banco de modo simples, pare o servidor primeiro e copie toda a pasta data (incluindo arquivos auxiliares SQLite, se houver). Teste a restauração antes de usar em produção. Não trate cópia de banco vivo como backup consistente.

Dockerfile incluído para avaliação de implantação; construção Docker não é considerada verificada sem execução. Para rede pública, configure proxy HTTPS e política correta de cookies/proxy antes de disponibilizar.

## Titularidade

Código e arquivos nesta pasta devem ser mantidos em repositório e infraestrutura controlados pela empresa, conforme o mapa. Contas, domínio, contratos e aprovação legal dependem dos responsáveis do produto.
