/**
 * PII: mascarada por padrão, revelar é ação auditada (decisão D7).
 *
 * O painel lida com CPF, CNPJ, WhatsApp e endereço de TERCEIROS — gente que
 * nunca consentiu em aparecer numa tela de administração. A regra prática que
 * decorre disso: listagem nunca mostra documento; a visão 360 mostra
 * mascarado; e ver o valor inteiro é um clique com motivo, que fica gravado.
 *
 * A pergunta que isso responde é "quem viu o CPF do fulano e por quê" — que
 * aparece exatamente no dia em que alguma coisa deu errado.
 */

/** Campos que nunca aparecem inteiros sem uma revelação auditada. */
export const CAMPOS_PII = new Set([
  'cpf_cnpj', 'whatsapp', 'email', 'brand_email', 'contact_phone',
  'tomador_cnpj', 'cnpj', 'signer_email', 'signer_ip', 'shipping_address',
])

export function ehPII(campo: string): boolean {
  return CAMPOS_PII.has(campo)
}

/**
 * Máscara que preserva o suficiente para CONFERIR sem expor.
 *
 * Manter os últimos dígitos é deliberado: no suporte a pergunta quase sempre é
 * "é este mesmo CPF que o cliente me passou?", e o fim do número responde isso
 * sem revelar o documento. Uma máscara total obrigaria a revelar toda vez, o
 * que transformaria a auditoria em ruído e o clique em hábito.
 */
export function mascarar(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  const s = String(valor)

  if (campo === 'email' || campo === 'brand_email' || campo === 'signer_email') {
    const [nome, dominio] = s.split('@')
    if (!dominio) return '•••'
    const visivel = nome.slice(0, 2)
    return `${visivel}${'•'.repeat(Math.max(nome.length - 2, 1))}@${dominio}`
  }

  if (campo === 'cpf_cnpj' || campo === 'cnpj' || campo === 'tomador_cnpj') {
    const digitos = s.replace(/\D/g, '')
    if (digitos.length < 4) return '•••'
    return `${'•'.repeat(digitos.length - 4).replace(/(.{3})/g, '$1.')}${digitos.slice(-4)}`
  }

  if (campo === 'whatsapp' || campo === 'contact_phone') {
    const digitos = s.replace(/\D/g, '')
    return digitos.length < 4 ? '•••' : `(••) •••••-${digitos.slice(-4)}`
  }

  // Padrão: endereço, JSON, o que vier. Um campo novo entra mascarado por
  // omissão — o lado seguro de esquecer de tratá-lo aqui.
  return '•'.repeat(Math.min(s.length, 12))
}

/**
 * Mascara um objeto inteiro — usado no `antes`/`depois` da auditoria.
 *
 * O log registra QUE mudou, não replica o dado sensível num segundo lugar.
 * Sem isto, a tabela de auditoria viraria o maior repositório de CPF do
 * sistema, com retenção de 5 anos.
 */
export function mascararObjeto(obj: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!obj) return null
  const saida: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(obj)) {
    saida[chave] = ehPII(chave) ? mascarar(chave, valor) : valor
  }
  return saida
}
