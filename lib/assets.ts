/**
 * Onde os arquivos de marca são buscados — o repositório `krew-assets`,
 * publicado em `assets.bekrew.com`.
 *
 * Os logos de rede viviam copiados no `public/` dos três produtos. Medido: 113
 * pares de arquivo mantidos à mão, e a cópia derivava em silêncio — o
 * `krew.svg` ficou duas versões atrás no admin e na landing por dias, porque um
 * SVG velho não quebra nada, só fica errado.
 *
 * ---------------------------------------------------------------------------
 * Variável de ambiente, e não literal
 * ---------------------------------------------------------------------------
 * Sem `NEXT_PUBLIC_ASSETS_URL` a função devolve o caminho como veio, e o Next
 * serve do `public/` local — que é o que faz o `npm run dev` continuar
 * funcionando offline, e o que torna a migração REVERSÍVEL: se algo der errado
 * com o domínio, tirar a variável volta tudo ao estado anterior sem deploy de
 * código.
 *
 * É também a ordem segura de subir isto: a variável só entra depois de
 * `assets.bekrew.com` estar de pé, e as cópias locais só saem depois de a
 * variável estar valendo em produção. Apagar antes derruba a marca dos três
 * sites de uma vez.
 *
 * ---------------------------------------------------------------------------
 * A URL termina em `/v1`
 * ---------------------------------------------------------------------------
 * Os arquivos são servidos com `max-age=31536000, immutable`: trocar um arquivo
 * no lugar NÃO chega a quem já baixou. Mudança visual de marca abre `/v2/` no
 * `krew-assets` e troca esta variável — arquivo novo em pasta nova tem URL
 * nova, e URL nova nunca está no cache de ninguém.
 *
 * É a mesma regra que `montarPathCapa` aplica sorteando um UUID por upload, e
 * pela mesma razão medida lá: "a URL pública de um arquivo sobrescrito continua
 * servindo a imagem antiga em CDN e no navegador".
 */
const BASE = process.env.NEXT_PUBLIC_ASSETS_URL?.replace(/\/+$/, '') ?? ''

/**
 * Caminho de asset compartilhado → URL final.
 *
 * Recebe sempre o caminho com barra na frente (`/logos/redes/krew.svg`), o
 * mesmo que valia quando o arquivo era local: assim o registry de plataformas e
 * os `<img>` continuam legíveis, e quem lê `logo: '/logos/redes/x.svg'` não
 * precisa saber de onde ele vem hoje.
 */
export function assetUrl(caminho: string): string {
  return BASE ? `${BASE}${caminho}` : caminho
}
