# Banco Supabase — MENTRA LIFE

Projeto solicitado: mmhvbjmetsuscnyzsvxg.

## Estado real

A migração foi preparada localmente. Não foi aplicada ao projeto online: a sessão de automação ainda exige autenticação. O backend em server/app.js continua usando SQLite e autenticação própria. Criar essas tabelas NÃO conecta o app ao Supabase, não transfere os usuários locais e não ativa integrações, pagamentos ou notificações externas.

## Estrutura do núcleo

- Supabase Auth: usuários, credenciais e sessões são gerenciados pelo serviço; não criar outra tabela de senhas.
- profiles: nome, fuso IANA validado, onboarding e preferências. Trigger cria o perfil no cadastro. Contas Auth anteriores recebem perfil na primeira aplicação.
- items: tarefas, eventos, lembretes e memórias; notas, origem, estado, vencimento UTC e prioridades.
- messages: histórico de conversa, com papel e conteúdo.
- undo_actions: mudanças necessárias para desfazer e estado de uso.
- chat_requests: entrada/resposta e chave idempotente por conta.
- conversations: contexto pendente e referências da conversa em JSON.

Seis tabelas públicas, todas com RLS e vínculos a auth.users com ON DELETE CASCADE. Cada usuário autenticado lê apenas seus dados. Pode editar o perfil e criar/editar/excluir seus itens. Não pode modificar proprietário, identidade ou tipo de um item. Anônimos não acessam tabelas. Funções de trigger não têm EXECUTE público.

Histórico, desfazer, cache idempotente e contexto são gravados somente pelo backend confiável (service_role). Essa chave nunca pode ir ao frontend. O backend deverá validar o JWT e derivar user_id dele, jamais confiar no user_id enviado pelo navegador. Não existe RPC pública para falsificar a confirmação de gravação. Não foi implementado nesta etapa o processamento transacional de chat/desfazer no Supabase.

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

## Integração do app pendente

Adaptar o backend/frontend ao Supabase Auth; mapear campos camelCase atuais para snake_case; implementar chat/CRUD/desfazer transacionais com confirmação somente após COMMIT; manter transcrição no servidor; testar exportação/exclusão completas. Migração de senhas scrypt/sessões SQLite não é automática: exige um plano de migração de contas e, se necessário, redefinição de senha. Não mudar silenciosamente a autenticação em produção.
