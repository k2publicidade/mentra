# Imagens 3D da Mentra

Coleção produzida com `image_gen` integrado, em verde sálvia, verde floresta e marfim. Acabamento fosco, luz de estúdio suave e fundo transparente. Os prompts completos estão em [prompts.md](prompts.md).

| Imagem | Essência | Aplicação |
| --- | --- | --- |
| `balance-master.png` | Clareza, equilíbrio, leveza | Entrada e estado inicial de Vida |
| `agenda-master.png` | Organização e um próximo passo claro | Agenda sem pendências na data |
| `conversation-master.png` | Conversa, acolhimento, menos coisas na cabeça | Abertura de Mentra |

Mestres PNG neste diretório. Publicação em `public/artwork`: WebP 320/640 com alfa e PNG 640 como fallback. Arquivos 320 entre 11,5 e 14,7 KB; versões 640 entre 28,8 e 35,8 KB. O componente `Artwork` usa imagens responsivas, dimensões reservadas, decodificação assíncrona e prioridade baixa. Elementos decorativos são ocultos da acessibilidade; os textos e as ações continuam em HTML.

Redução e codificação executadas com Sharp do runtime de documentos, sem adicionar dependências ao aplicativo. Apenas ajustes técnicos de tamanho/formato, preservando a transparência gerada. Originais mantidos também no diretório padrão da ferramenta.
