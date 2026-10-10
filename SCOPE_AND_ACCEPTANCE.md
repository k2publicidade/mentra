# Critérios de aceite e dependências — MENTRA LIFE

Fonte: mapa de implementação v1.0 fornecido. PRD Técnico Mestre não fornecido.

## Núcleo implementado sujeito aos testes integrados

- Cadastro/login/sessão com contas isoladas; onboarding progressivo.
- Hoje, Mentra, Vida e Eu responsivos.
- Banco SQLite persistente para tarefas, eventos, lembretes, memórias e conversas.
- Captura local em português, perguntas quando falta horário, consulta e correção do registro recente.
- Criação manual, edição, conclusão, busca e prioridades limitadas a três.
- Desfazer transacional com proteção contra alterações posteriores.
- Memória com origem editável e exclusão.
- Exportação JSON autorizada e calendário .ics autorizado.
- Fuso por conta; rejeição de horários ambíguos/inexistentes em regras testadas.
- Confirmação após persistência; transações revertidas em falhas; deduplicação por requestId de conversa.
- Exclusão integral da conta e dos registros associados.

## Suporte condicionado ao navegador

- Gravação via MediaRecorder: HTTPS confiável, navegador e permissão de microfone obrigatórios. Transcrição externa BRAINIALL por padrão, com chave/créditos no servidor; OpenAI opcional. Fluxo e bytes testados com microfone sintético/fornecedor local, não qualidade de fala humana ou aparelhos físicos. Não grava em segundo plano nem arquiva áudio.
- Notificação local com página aberta: permissão obrigatória; não é push e não garante entrega em segundo plano.

## Não implementado / bloqueia afirmar produto completo publicado

- LLM/IA de conversa externa. Transcrição externa está implementada mas não ativada/testada com credenciais reais nesta entrega.
- Sincronização externa bidirecional e resolução de conflitos de calendário.
- Push persistente, fila de entrega e resumos em horários programados.
- Recuperação de senha e verificação de e-mail.
- Venda Free/Premium, processamento de pagamentos, assinatura/cancelamento e webhook da operadora.
- Mentra Box/WhatsApp: número, fornecedor, vínculo, Premium, reenvios e política do canal.
- Aplicativos nativos e publicação em lojas.
- Recursos das fases 2–4: documentos/imagens, pessoas/projetos, busca semântica, pesquisa/comparação externa, reservas e transações.
- Infraestrutura pública, domínio, monitoramento de custos/latência, backups operacionais, revisão independente de segurança/LGPD e suporte.
- Titularidade/empresa, contratos, endereço e aprovação de Larissa.

## Decisões necessárias antes da próxima etapa

Fornecer PRD Técnico Mestre citado no mapa; aprovar recorte de lançamento; escolher fornecedor de IA/voz, calendário, hospedagem e autenticação; definir planos/preços/quotas/retenção; decidir se Mentra Box entra; aprovar políticas e orçamento. Não usar valores inventados como decisões do produto.

Não existe evidência capaz de assegurar ausência absoluta de bugs. '100% funcionando' deve significar todos os critérios aprovados para um escopo definido, com limites conhecidos e evidência real, não apenas uma tela que abre.
