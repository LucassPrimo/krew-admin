# Relatório de Analytics

A exportação usa `get_bio_painel`, a mesma consulta do painel do krew-app,
via conexão administrativa somente de leitura. O endpoint exige `exigirAtor`
e resolve a pessoa e a organização pelo ID da página; não usa o cookie de edição.
Funciona também com as contas provisórias das ofertas, antes do aceite.

O período padrão do download é sempre `30d`, independentemente do seletor da
página. `7d` e `hoje` também estão disponíveis. A geração fixa um único instante
para o fim da janela e para a capa. Hoje começa à meia-noite em São Paulo.

O PDF é gerado no servidor, com @react-pdf/renderer, sem Chromium, serviços
externos ou uploads. O arquivo não é persistido e sua resposta usa `no-store`.
Os elementos são vetoriais; o relatório não depende do tamanho da janela do
navegador nem do carregamento dos gráficos interativos.

As seções usam as definições do RPC: origens, aparelhos e geografia contam
page views; a média diária usa dias ativos. Rankings limitados indicam os itens
omitidos e usam como denominador todos os itens retornados pelo RPC. O relatório
não inclui a janela de tempo real, que não corresponde ao período escolhido.

## Conferência visual

```sh
npx vite-node --config vitest.config.ts scripts/preview-analytics-pdf.ts
```

Gera exemplos com dados fictícios e sem eventos em `/tmp/krew-analytics-pdf`.
Use `PDF_QA_DIR` para escolher outra pasta. Os exemplos não consultam o banco.
Confira as seis páginas A4 após mudanças de layout, incluindo textos longos.

## Mapa

`mapa.json` contém apenas a geometria extraída de `public/mapa-mundi.svg`.
Autor: Al MacDonald. Editor: Fritz Lekschas. Simple World Map.
Licença: CC BY-SA 3.0, https://creativecommons.org/licenses/by-sa/3.0/.
A geometria mantém essa licença. Adaptações: conversão de SVG para caminhos JSON
e aplicação de cores por volume de visitas. A atribuição também aparece no PDF.
