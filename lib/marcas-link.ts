/** Link do convite de acesso ao piloto de marcas, no portal da marca
 *  (repo `krew-marca`). Sem dependência de servidor: a tela de liberação
 *  (componente de cliente) também monta o link. */
export const MARCA_ORIGIN = 'https://marca.bekrew.com'
export const linkDeAcesso = (token: string) => `${MARCA_ORIGIN}/acesso/${token}`
