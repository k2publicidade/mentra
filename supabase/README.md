# Banco Supabase — MENTRA LIFE

Projeto solicitado: mmhvbjmetsuscnyzsvxg.

## Estado real

Em 10/10/2026, o banco online foi verificado diretamente por PostgreSQL com TLS e CA oficial: seis tabelas com RLS, políticas de proprietário, triggers, limite de prioridades e permissões das funções conferidos. As duas migrações já estão aplicadas; não reaplicar a migração inicial. A Vercel usa server/online-app.js com Supabase Auth e PostgreSQL. server/app.js continua sendo o modo SQLite local, sem transferência automática de contas ou dados.

## Estrutura do núcleo

- Supabase Auth: usuários, credenciais e sessões são gerenciados pelo serviço; não criar outra tabela de senhas.
- profiles: nome, fuso IANA validado, onboarding e preferências. Trigger cria o perfil no cadastro. Contas Auth anteriores recebem perfil na primeira aplicação.
- items: tarefas, eventos, lembretes e memórias; notas, origem, estado, vencimento UTC e prioridades.
- messages: histórico de conversa, com papel e conteúdo.
- undo_actions: mudanças necessárias para desfazer e estado de uso.
- chat_requests: entrada/resposta e chave idempotente por conta.
- conversations: contexto pendente e referências da conversa em JSON.

Seis tabelas públicas, todas com RLS e vínculos a auth.users com ON DELETE CASCADE. Cada usuário autenticado lê apenas seus dados. Pode editar o perfil e criar/editar/excluir seus itens. Não pode modificar proprietário, identidade ou tipo de um item. Anônimos não acessam tabelas. Funções de trigger não têm EXECUTE público.

Histórico, desfazer, cache idempotente e contexto são gravados pelo backend confiável via PostgreSQL. A Vercel usa a conexão postgres pelo transaction pooler; a chave service_role é usada exclusivamente para excluir contas no Supabase Auth. Segredos nunca vão ao frontend. O backend valida a identidade no Supabase Auth e deriva user_id dela. Chat e desfazer são transacionais; gravação, histórico e resposta idempotente só são confirmados após COMMIT.

Datas são timestamptz, com índices por proprietário, estado, tipo e vencimento. Triggers mantêm timestamps de criação/alteração de itens/perfis. Até três prioridades pendentes por conta: três slots com CHECK e UNIQUE tornam impossível gravar uma quarta, mesmo com uma seleção concorrente desatualizada. O trigger também serializa alocação por conta com advisory lock. Em disputa, o cliente deve tratar erros de integridade e recarregar; não prometer sucesso otimista.

Não há áudio armazenado, chave de fornecedor, plano Premium autodeclarado nem tabelas inventadas para fornecedores ainda não escolhidos.

## Aplicação segura

1. Abrir https://supabase.com/dashboard/project/mmhvbjmetsuscnyzsvxg/sql/new com acesso autorizado.
2. Executar apenas as consultas de inventário no começo de verification.sql e confirmar o projeto. Inspecionar tabelas/funções/triggers existentes antes da migração.
3. Se existirem objetos com os mesmos nomes, NÃO apagar nem sobrescrever: preparar migração específica para o estado encontrado.
4. No projeto compatível, executar migrations/202610090001_mentra_core.sql uma vez. É transacional; colisões abortam em vez de substituir objetos.
5. Executar verification.sql e ler de volta seis tabelas/RLS, políticas, triggers e restrições. Nenhum conteúdo privado precisa ser exposto.
6. Testar com duas contas reais de teste e a chave publicável: isolamento, cadastro, alterações e exclusão. Os testes locais não substituem essa validação online.

## Testes locais

node --test tests/supabase-schema.test.js
npm test
npm run build

Os testes usam PostgreSQL embarcado PGlite. O schema auth, a função auth.uid e as roles são simulações restritas ao teste. A migração real usa os objetos nativos do Supabase. Testes cobrem validação, UTC, RLS entre contas, bloqueio anônimo, histórico protegido, cascata de exclusão, idempotência, prioridades, perfis de contas preexistentes, timestamps e reaplicação recusada. PGlite não simula clientes concorrentes independentes; a garantia estrutural dos slots é testada, mas a disputa precisa de teste adicional no servidor real.

## Integração online

Supabase Auth, mapeamento camelCase/snake_case, CRUD/chat/desfazer transacionais, exportação e exclusão por cascata foram implementados e verificados no deploy real com duas contas descartáveis. A migração 202610100001_mentra_server_undo.sql preserva timestamps ao desfazer. Os testes online também verificaram concorrência real no limite de prioridades, replay idempotente e atualização de preferências. Veja ../ONLINE_DEPLOYMENT.md e ../VERIFICATION.md.

Migração de senhas scrypt/sessões SQLite não é automática: exige um plano de migração de contas. Confirmação de e-mail temporariamente desativada por solicitação do usuário; SMTP próprio ainda não configurado. Voz depende da chave BRAINIALL do responsável.
