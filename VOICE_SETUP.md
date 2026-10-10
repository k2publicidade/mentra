# Voz no Android e iPhone — MENTRA LIFE

## Fonte solicitada

Catálogo enviado: https://github.com/api-evangelist/public-apis
Ele descreve o diretório https://github.com/public-apis/public-apis. Na lista consultada constam BRAINIALL, Audexum e Speak AI para reconhecimento/transcrição; todos indicam apiKey. O catálogo não fornece chaves, saldo, transcrição hospedada ou garantia de qualidade.

Provedor padrão escolhido: BRAINIALL, por ter contrato específico PT-BR publicado na referência listada. Contrato:
https://raw.githubusercontent.com/fasuizu-br/brainiall-transcription-skill/main/openapi/brainiall-diarized-transcription.openapi.json
Portal: https://app.brainiall.com/
Endpoint: https://api.brainiall.com/v1/whisper/transcribe

Qualidade, prazo, preços, retenção do fornecedor e termos precisam de validação com sua conta antes do uso comercial. As alegações de marketing do fornecedor não são resultados de testes do MENTRA LIFE.

## Ativar o fornecedor com segurança

1. Crie/acesse uma conta própria no portal, confira termos, preço e saldo e gere uma chave dedicada/revogável.
2. Na pasta do projeto, copie .env.example para .env usando o Explorador ou seu editor.
3. Edite SOMENTE no computador:

    VOICE_PROVIDER=brainiall
    BRAINIALL_API_KEY=<sua chave, preenchida apenas no arquivo local>

4. Não envie a chave no chat, em captura de tela ou no GitHub. Não use VITE_* para segredos. .env está ignorado pelo Git.
5. Reinicie o servidor depois de configurar. npm start e npm run start:mobile carregam o .env.

Alternativa opcional se quiser usar sua conta OpenAI: VOICE_PROVIDER=openai e OPENAI_API_KEY no servidor. Selecionar fornecedor não faz uma chamada paga automaticamente.

## Acesso pelo celular requer HTTPS confiável

http://127.0.0.1:3000 no celular aponta para o próprio celular, não para o computador. HTTP com IP da rede normalmente não libera getUserMedia. Ignorar aviso de certificado não equivale a HTTPS confiável.

Para produção/piloto, prefira domínio HTTPS com certificado público e hospedagem aprovada. Não foi publicado nenhum domínio ou túnel por esta implementação.

Para teste local neste computador foram gerados certificados de desenvolvimento em data/tls, para localhost, 127.0.0.1 e 192.168.1.41. Se o IP do computador mudar, será necessário regenerar o certificado com o novo IP.

    npm run build
    npm run start:mobile

No celular, conectado ao mesmo Wi-Fi, abra:

    https://192.168.1.41:3443

A porta deve estar acessível na sua rede privada. Nenhuma regra de firewall foi aberta automaticamente. Se o Windows perguntar, autorize somente a rede privada em que deseja testar; nunca exponha essa porta diretamente na internet.

## Confiar no certificado local — apenas dispositivos de teste próprios

Arquivo público a transferir ao telefone:
C:\Users\ntbk\Documents\mentra\data\tls\mentra-root-ca.crt

Nunca transfira root-ca.key ou server.key. Instalar uma CA altera a confiança do dispositivo; faça isso somente no seu aparelho de teste e remova após o teste. Não foi instalada confiança automaticamente no Windows ou no celular.

Fingerprint SHA-256 da CA gerada nesta máquina:
7D:73:6B:2C:A0:08:6C:CD:A7:33:B4:BD:1E:B4:FD:9F:72:87:08:BA:68:F0:D6:A6:0D:07:3A:C0:6C:44:59:F5

iPhone: importe o certificado pelo método permitido pelo aparelho, instale o perfil e habilite confiança completa da CA em Ajustes > Geral > Sobre > Ajustes de Confiança de Certificados. Os nomes podem variar pela versão do iOS; dispositivos corporativos podem proibir. Use Safari para primeiro teste.

Android: instale como certificado de CA nas configurações de segurança/criptografia e credenciais (o caminho varia por fabricante). Confirme que o Chrome abre o site sem alerta de certificado. Políticas corporativas e navegadores podem limitar CAs locais. Não reduza a segurança do navegador; se não confiar na CA, use um domínio com certificado público.

## Fluxo esperado

Mentra > gravar áudio > consentir/permissão > falar > parar > ouvir/descartar > transcrever > revisar texto > enviar > confirmar registro salvo em Vida.

A gravação não deve criar tarefas automaticamente. Não há envio de áudio antes do comando explícito de transcrição. Áudio permanece temporariamente em memória e não é arquivado pela aplicação; o fornecedor recebe o áudio e segue sua própria política de retenção.

Limite inicial: 120 segundos e 10 MiB por gravação. Gravação com a tela bloqueada, troca de aplicativo e chamadas podem ser interrompidas pelo sistema. O app deve informar interrupção; não promete gravação de fundo.

Falha/timeout pode ocorrer depois de o fornecedor consumir crédito. Não há repetição automática: antes de repetir manualmente, verifique consumo; novo envio pode custar novamente.

## Limites de custo/duração

O gravador limita a gravação a 120 segundos. O servidor limita bytes (10 MiB), frequência, concorrência, tamanho da resposta e prazo da requisição, mas não decodifica a duração do áudio: um cliente direto pode enviar áudio mais longo abaixo desse limite de bytes. Antes de operação pública, implemente duração/quota de custo no servidor ou use restrições da conta do fornecedor. Não exponha esta versão como serviço público ilimitado.

## Testes e limites de evidência

Testes com microfone sintético e fornecedor local simulado validam gravador, bytes, upload, erros, revisão e persistência. Eles NÃO validam reconhecimento de fala humana pela BRAINIALL, nem Safari real em iPhone ou Chrome real em Android.

A validação real exige chave/saldo, HTTPS confiável, aparelho Android e iPhone, áudio autorizado e comparação da transcrição com a fala. Não declarar 'perfeito' antes desses testes; mesmo depois, reconhecimento pode errar nomes, datas e fala com ruído.
