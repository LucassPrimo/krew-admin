import type { Locale } from '@/i18n/request'

export type CampaignStatus = 'ativa' | 'concluida' | 'cancelada'
export type DeliverableStatus = 'a_gravar' | 'em_aprovacao' | 'aprovado' | 'reprovado' | 'postado'
export type DeliverableTipo = 'Reels' | 'Stories' | 'TikTok' | 'YouTube' | 'Post' | 'Outro'
export type ReceivableStatus = 'pendente' | 'pago' | 'atrasado'
export type ExpenseCategoria = 'producao' | 'equipamentos' | 'equipe' | 'ferramentas' | 'impostos' | 'outros'
export type TipoPessoa = 'MEI' | 'PJ' | 'PF'

export type AvailabilityStatus = 'open' | 'limited' | 'closed'
export type FormFont = 'sans' | 'display' | 'mono' | 'poppins' | 'playfair' | 'grotesk'
export type PageTheme = 'light' | 'dark'
export type BorderStyle = 'rounded' | 'square'
export type ProposalType = 'paid' | 'seeding'
export type ProposalStatus = 'inbox' | 'in_negotiation' | 'closed' | 'declined' | 'auto_declined'
export type DeliverableItemTipo = 'reels' | 'stories' | 'tiktok' | 'post' | 'youtube'

export type IncomeSourceTipo =
  | 'adsense' | 'tiktok_fund' | 'twitch' | 'afiliados' | 'infoproduto'
  | 'assinatura' | 'palestra' | 'licenciamento' | 'outro'
export type IncomeSourceRecorrencia = 'avulsa' | 'mensal' | 'anual'

export interface DeliverableCartItem {
  type: DeliverableItemTipo
  qty: number
}

export interface ShippingAddress {
  nome: string
  cep: string
  endereco: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  estado: string
}

export interface Creator {
  id: string
  user_id: string
  slug: string
  min_budget_cents: number | null
  availability_status: AvailabilityStatus
  availability_note: string | null
  welcome_message: string | null
  form_font: FormFont
  form_color: string
  title_text: string | null
  title_font: FormFont
  theme: PageTheme
  bg_color: string
  border_style: BorderStyle
  /** Claro/escuro só da bio — o resto do tema é compartilhado. Ver
   *  `app/actions/aparencia.ts`. */
  bio_theme: PageTheme
  locale: Locale
  created_at: string
}

export interface PartnershipProposal {
  id: string
  creator_id: string
  tracking_token: string
  brand_instagram_handle: string | null
  brand_avatar_url: string | null
  brand_name: string | null
  brand_email: string
  brand_cnpj: string | null
  brand_website: string | null
  brand_sector: string | null
  contact_name: string | null
  contact_phone: string | null
  type: ProposalType
  deliverables: DeliverableCartItem[]
  budget_cents: number | null
  pitch_text: string | null
  pitch_media_url: string | null
  shipping_address: ShippingAddress | null
  status: ProposalStatus
  ai_summary: string | null
  decline_reason: string | null
  viewed_at: string | null
  response_sent_at: string | null
  created_at: string
}

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  nicho: string | null
  cidade: string | null
  estado: string | null
  tipo_pessoa: TipoPessoa | null
  /** Alíquota municipal de ISS em PERCENTUAL (3 = 3%). null = não informada. */
  iss_aliquota: number | null
  cpf_cnpj: string | null
  onboarding_step: number
  created_at: string
}

export interface SocialNetwork {
  id: string
  user_id: string
  platform: string
  handle: string
  created_at: string
  // Vieram com a página de bio (migration 20260817174030_bio_link):
  // `url` para as redes sem handle (site próprio, Spotify) e `ordem`/`ativo`
  // para o criador escolher o que aparece e em que sequência.
  url: string | null
  ordem: number
  ativo: boolean
}

export interface BrandContact {
  id: string
  brand_id: string
  nome: string | null
  email: string | null
  telefone: string | null
  created_at: string
}

export interface Brand {
  id: string
  user_id: string
  nome: string
  cnpj: string | null
  website: string | null
  sector: string | null
  notas: string | null
  created_at: string
  brand_contacts?: BrandContact[]
}

export interface Campaign {
  id: string
  user_id: string
  brand_id: string | null
  nome: string | null
  valor_total: number
  eh_permuta: boolean
  data_inicio: string | null
  data_fim: string | null
  status: CampaignStatus
  share_token: string
  notas: string | null
  /** Cor no calendário, hex `#RRGGBB`. Null = derivada do id (`corDaCampanha`). */
  cor: string | null
  created_at: string
  brands?: Brand
}

export interface Deliverable {
  id: string
  campaign_id: string
  tipo: DeliverableTipo
  data_prazo: string | null
  status: DeliverableStatus
  checklist: ChecklistItem[]
  titulo: string | null
  roteiro: string | null
  link: string | null
  created_at: string
}

export interface ChecklistItem {
  id: string
  texto: string
  feito: boolean
}

export interface Receivable {
  id: string
  org_id: string
  /** Nullable desde o Bloco 3: recebível pode nascer fora de campanha. */
  campaign_id: string | null
  income_source_id: string | null
  /** Bruto (decisão D2) — `valor` é o canônico e não mudou de significado. */
  valor: number
  /** `{iss, irrf, pis, cofins, csll}`, em reais. Bloco 4. */
  retencoes: Record<string, number>
  /** Coluna GERADA pelo banco: `valor` menos a soma das retenções. Só leitura. */
  valor_liquido: number
  data_prevista: string | null
  status: ReceivableStatus
  data_pagamento: string | null
  descricao: string | null
  created_at: string
}

export interface IncomeSource {
  id: string
  org_id: string
  nome: string
  tipo: IncomeSourceTipo
  recorrencia: IncomeSourceRecorrencia
  valor_estimado: number | null
  ativo: boolean
  created_at: string
}

export interface Expense {
  id: string
  user_id: string
  categoria: ExpenseCategoria
  valor: number
  data: string
  descricao: string | null
  /** Caminho no bucket privado `documentos`, não URL. Bloco 4. */
  comprovante_path: string | null
  created_at: string
}

export interface AiInteraction {
  id: string
  user_id: string
  tipo: 'precificacao' | 'negociacao' | 'duvida_burocratica'
  input: string | null
  output: string | null
  created_at: string
}
