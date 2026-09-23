# Design do Admin

A interface adapta as orientações da [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) para o admin web da Krew, mantendo sua identidade e tema escuro.

## Regras aplicadas

- Navegação: material translúcido na sidebar e toolbar, inspirado na separação de camadas descrita em [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/).
- Conteúdo: cards e tabelas opacos, bordas discretas e sombras leves.
- Tipografia: fonte de sistema, títulos maiores, números com alinhamento tabular e texto secundário legível.
- CRM: navegação segmentada entre Kanban e ofertas.
- Acessibilidade: foco visível, estados de navegação anunciados e preferências de movimento, transparência e contraste respeitadas.

Os estilos do admin ficam limitados a `.admin-shell`. A prévia pública dos creators mantém sua identidade. A translucidez CSS é uma adaptação web, não uma implementação do material nativo Liquid Glass.

## Validação visual

Ao revisar novas telas, conferir navegação por teclado, leitura de tabelas e cards, campos e ações em telas estreitas e as preferências de acessibilidade. Conteúdo nunca deve depender apenas de cor para comunicar estado.
