/**
 * Nomes dos headers que o proxy.ts usa para passar ao Server Component a
 * identidade que ele acabou de validar — evita que `exigirAdmin()` repita as
 * mesmas duas chamadas de rede ao servidor de auth a cada navegação.
 *
 * Sem imports de propósito: este arquivo é importado tanto pelo proxy.ts
 * (edge, sem driver de Postgres) quanto por lib/auth.ts (Node) — puxar
 * qualquer coisa a mais aqui arrisca quebrar um dos dois lados.
 */
export const HEADER_ADMIN_UID = 'x-krew-admin-uid'
export const HEADER_ADMIN_EMAIL = 'x-krew-admin-email'
export const HEADER_ADMIN_AAL = 'x-krew-admin-aal'
