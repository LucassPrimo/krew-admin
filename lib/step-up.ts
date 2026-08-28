/** Janela do step-up: uma verificação de TOTP vale por 15 minutos para escrever. */
export const STEP_UP_MAX_MS = 15 * 60 * 1000

/**
 * Quando o TOTP desta sessão foi verificado, em ms — ou 0 se não foi.
 *
 * O dado mora na claim `amr` do access token ("authentication methods
 * references"), que lista cada método usado e o instante em que aconteceu. Não
 * está no objeto `User` do supabase-js, então lemos do próprio JWT.
 *
 * Só o PAYLOAD é lido, e nada aqui depende de o token ser autêntico: quem já
 * chegou neste ponto passou por `exigirAtor()`, que validou a sessão contra o
 * servidor de auth. Isto responde "há quanto tempo?", não "quem é?" — e por
 * isso não precisa (nem deve fingir que faz) verificação de assinatura.
 */
export function momentoDoTotp(accessToken: string | undefined): number {
  if (!accessToken) return 0
  const payload = accessToken.split('.')[1]
  if (!payload) return 0

  try {
    // JWT usa base64url; Buffer entende, mas o padding precisa existir.
    const json = Buffer.from(payload, 'base64url').toString('utf8')
    const claims = JSON.parse(json) as { amr?: { method: string; timestamp: number }[] }
    const totp = claims.amr?.find((m) => m.method === 'totp')
    return totp?.timestamp ? totp.timestamp * 1000 : 0
  } catch {
    // Token em formato inesperado: trate como "sem step-up". O lado seguro do
    // erro aqui é pedir o código de novo, nunca liberar a escrita.
    return 0
  }
}
