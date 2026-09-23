/** Link do convite de acesso ao piloto de marcas, no app. Sem dependência de
 *  servidor: a tela de liberação (componente de cliente) também monta o link. */
export const APP_ORIGIN = 'https://app.bekrew.com'
export const linkDeAcesso = (token: string) => `${APP_ORIGIN}/marca/acesso/${token}`
