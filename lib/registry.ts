/**
 * O registry: o mapa do que o painel pode editar.
 *
 * Por que não um editor genérico de tabelas: um `UPDATE` livre sobre produção é
 * exatamente como se corrompe um banco às 2 da manhã. Aqui cada campo editável
 * é DECLARADO, com tipo, validação e — quando muda de dono ou de dinheiro —
 * confirmação por digitação.
 *
 * O contrato que isso cria: coluna fora do registry é invisível e intocável.
 * Coluna nova no banco aparece em /integridade como "não mapeada", que é o
 * painel avisando que envelheceu em relação ao schema, em vez de deixar um
 * campo novo editável por acidente.
 *
 * Cobertura desta rodada: o núcleo do suporte real (14 tabelas). O resto do
 * banco continua visível em /dados por introspecção, só que sem edição.
 */

export type TipoCampo = 'text' | 'textarea' | 'numero' | 'dinheiro' | 'inteiro'
  | 'booleano' | 'enum' | 'data' | 'ts' | 'uuid' | 'json'

export type Campo = {
  tipo: TipoCampo
  editavel: boolean
  rotulo?: string
  opcoes?: string[]
  min?: number
  max?: number
  /**
   * Campo que muda de dono, de dinheiro ou de acesso. Exige confirmação por
   * digitação antes de gravar — o padrão do GitHub para ação irreversível.
   */
  perigoso?: boolean
  /** Texto explicando o que a mudança causa, mostrado no diff. */
  nota?: string
}

export type TabelaAdmin = {
  tabela: string
  rotulo: string
  chave: string
  /** Colunas usadas pela busca da listagem. */
  busca: string[]
  /** Ordenação padrão da listagem. */
  ordem: string
  colunas: Record<string, Campo>
}

const ts = { tipo: 'ts', editavel: false } as const
const uuidRO = { tipo: 'uuid', editavel: false } as const

export const REGISTRY: Record<string, TabelaAdmin> = {
  profiles: {
    tabela: 'profiles',
    rotulo: 'Perfis',
    chave: 'id',
    busca: ['full_name', 'sobrenome', 'cidade', 'id'],
    ordem: 'created_at desc',
    colunas: {
      id: uuidRO,
      full_name: { tipo: 'text', editavel: true, rotulo: 'Nome' },
      sobrenome: { tipo: 'text', editavel: true },
      avatar_url: { tipo: 'text', editavel: true },
      nicho: { tipo: 'text', editavel: true },
      cidade: { tipo: 'text', editavel: true },
      estado: { tipo: 'text', editavel: true },
      tipo_pessoa: { tipo: 'enum', editavel: true, opcoes: ['pf', 'pj'] },
      cpf_cnpj: { tipo: 'text', editavel: true, perigoso: true, nota: 'Documento fiscal — aparece em nota e contrato.' },
      whatsapp: { tipo: 'text', editavel: true },
      iss_aliquota: { tipo: 'numero', editavel: true, min: 0, max: 100 },
      account_type: {
        tipo: 'enum', editavel: true, opcoes: ['creator', 'agency'], perigoso: true,
        nota: 'Troca o app inteiro que a pessoa vê ao entrar.',
      },
      onboarding_step: { tipo: 'inteiro', editavel: true, min: 0, max: 10, nota: 'Voltar um passo faz a pessoa refazer aquela etapa.' },
      onboarding_data: { tipo: 'json', editavel: false },
      tour_state: { tipo: 'json', editavel: false },
      created_at: ts,
    },
  },

  organizations: {
    tabela: 'organizations',
    rotulo: 'Organizações',
    chave: 'id',
    busca: ['name', 'id'],
    ordem: 'created_at desc',
    colunas: {
      id: uuidRO,
      name: { tipo: 'text', editavel: true, rotulo: 'Nome' },
      tipo: { tipo: 'enum', editavel: true, opcoes: ['creator', 'agency'], perigoso: true },
      owner_user_id: { tipo: 'uuid', editavel: true, perigoso: true, nota: 'Transfere a organização inteira de dono.' },
      created_at: ts,
    },
  },

  memberships: {
    tabela: 'memberships',
    rotulo: 'Membros',
    chave: 'id',
    busca: ['org_id', 'user_id'],
    ordem: 'created_at desc',
    colunas: {
      id: uuidRO,
      org_id: { tipo: 'uuid', editavel: true, perigoso: true },
      user_id: { tipo: 'uuid', editavel: true, perigoso: true },
      role: {
        tipo: 'enum', editavel: true, perigoso: true,
        opcoes: ['owner', 'manager', 'editor', 'viewer'],
        nota: 'Muda o que a pessoa enxerga e altera na organização.',
      },
      created_at: ts,
    },
  },

  proposal_pages: {
    tabela: 'proposal_pages',
    rotulo: 'Páginas públicas / bio',
    chave: 'id',
    busca: ['slug', 'bio_headline', 'user_id'],
    ordem: 'created_at desc',
    colunas: {
      id: uuidRO,
      user_id: { tipo: 'uuid', editavel: false },
      org_id: { tipo: 'uuid', editavel: false },
      slug: { tipo: 'text', editavel: true, perigoso: true, nota: 'É a URL pública. Trocar quebra todo link já divulgado.' },
      bio_ativo: { tipo: 'booleano', editavel: true, nota: 'Desligar tira a /@handle do ar e some da busca.' },
      bio_verificado: {
        tipo: 'booleano', editavel: true, perigoso: true,
        nota: 'Selo de verificado. Concedido pela Krew — o dono não consegue ligar sozinho. O caminho do dia a dia é /verificados, que dispensa o código do autenticador; aqui continua valendo para correção pontual.',
      },
      bio_headline: { tipo: 'text', editavel: true },
      bio_texto: { tipo: 'textarea', editavel: true },
      bio_theme: { tipo: 'enum', editavel: true, opcoes: ['dark', 'light'] },
      bio_bg_color: { tipo: 'text', editavel: true },
      bio_capa_url: { tipo: 'text', editavel: true },
      bio_mostrar_seguidores: { tipo: 'booleano', editavel: true },
      bio_mostrar_propostas: { tipo: 'booleano', editavel: true },
      bio_esconder_marca: { tipo: 'booleano', editavel: true },
      availability_status: { tipo: 'enum', editavel: true, opcoes: ['open', 'limited', 'closed'] },
      availability_note: { tipo: 'text', editavel: true },
      min_budget_cents: { tipo: 'inteiro', editavel: true, min: 0 },
      welcome_message: { tipo: 'textarea', editavel: true },
      title_text: { tipo: 'text', editavel: true },
      locale: { tipo: 'enum', editavel: true, opcoes: ['pt-BR', 'en-US', 'es-ES'] },
      created_at: ts,
    },
  },

  subscriptions: {
    tabela: 'subscriptions',
    rotulo: 'Assinaturas',
    chave: 'user_id',
    busca: ['user_id', 'chargefy_customer_id', 'status'],
    ordem: 'updated_at desc',
    colunas: {
      user_id: uuidRO,
      status: {
        tipo: 'enum', editavel: true, perigoso: true,
        opcoes: ['active', 'trialing', 'past_due', 'canceled', 'incomplete'],
        nota: 'Divergir do Chargefy aqui faz o app liberar (ou bloquear) o Pro sem cobrança correspondente.',
      },
      trial_ends_at: { tipo: 'ts', editavel: true, nota: 'Estender o teste. É a ação mais comum de suporte.' },
      current_period_end: { tipo: 'ts', editavel: true, perigoso: true },
      cancel_at_period_end: { tipo: 'booleano', editavel: true },
      price_id: { tipo: 'text', editavel: false },
      chargefy_customer_id: { tipo: 'text', editavel: false },
      chargefy_subscription_id: { tipo: 'text', editavel: false },
      updated_at: ts,
    },
  },

  campaigns: {
    tabela: 'campaigns',
    rotulo: 'Campanhas',
    chave: 'id',
    busca: ['nome', 'id'],
    ordem: 'created_at desc',
    colunas: {
      id: uuidRO,
      nome: { tipo: 'text', editavel: true },
      valor_total: { tipo: 'dinheiro', editavel: true, min: 0 },
      status: { tipo: 'enum', editavel: true, opcoes: ['ativa', 'concluida', 'cancelada'] },
      eh_permuta: { tipo: 'booleano', editavel: true },
      data_inicio: { tipo: 'data', editavel: true },
      data_fim: { tipo: 'data', editavel: true },
      notas: { tipo: 'textarea', editavel: true },
      cor: { tipo: 'text', editavel: true },
      brand_id: { tipo: 'uuid', editavel: true, perigoso: true },
      org_id: { tipo: 'uuid', editavel: true, perigoso: true, nota: 'Muda a campanha de organização — ela some da carteira atual.' },
      user_id: { tipo: 'uuid', editavel: false },
      share_token: { tipo: 'uuid', editavel: false, nota: 'Regenerar é ação, não edição.' },
      created_at: ts,
    },
  },

  deliverables: {
    tabela: 'deliverables',
    rotulo: 'Entregáveis',
    chave: 'id',
    busca: ['titulo', 'tipo', 'campaign_id'],
    ordem: 'created_at desc',
    colunas: {
      id: uuidRO,
      campaign_id: { tipo: 'uuid', editavel: true, perigoso: true },
      titulo: { tipo: 'text', editavel: true },
      tipo: { tipo: 'text', editavel: true },
      status: { tipo: 'enum', editavel: true, opcoes: ['a_gravar', 'em_aprovacao', 'aprovado', 'reprovado', 'postado'] },
      data_prazo: { tipo: 'data', editavel: true },
      roteiro: { tipo: 'textarea', editavel: true },
      roteiro_status: { tipo: 'text', editavel: true },
      link: { tipo: 'text', editavel: true },
      created_at: ts,
    },
  },

  receivables: {
    tabela: 'receivables',
    rotulo: 'Recebíveis',
    chave: 'id',
    busca: ['descricao', 'campaign_id', 'org_id'],
    ordem: 'data_prevista desc',
    colunas: {
      id: uuidRO,
      descricao: { tipo: 'text', editavel: true },
      valor: { tipo: 'dinheiro', editavel: true, min: 0, perigoso: true },
      valor_liquido: { tipo: 'dinheiro', editavel: true, min: 0 },
      status: { tipo: 'enum', editavel: true, perigoso: true, opcoes: ['pendente', 'pago', 'atrasado', 'cancelado'] },
      data_prevista: { tipo: 'data', editavel: true },
      data_pagamento: { tipo: 'data', editavel: true },
      campaign_id: { tipo: 'uuid', editavel: true, perigoso: true },
      org_id: { tipo: 'uuid', editavel: false },
      created_at: ts,
    },
  },

  brands: {
    tabela: 'brands',
    rotulo: 'Marcas',
    chave: 'id',
    busca: ['nome', 'cnpj', 'website'],
    ordem: 'created_at desc',
    colunas: {
      id: uuidRO,
      nome: { tipo: 'text', editavel: true },
      cnpj: { tipo: 'text', editavel: true, perigoso: true },
      website: { tipo: 'text', editavel: true },
      sector: { tipo: 'text', editavel: true },
      notas: { tipo: 'textarea', editavel: true },
      org_id: { tipo: 'uuid', editavel: true, perigoso: true },
      user_id: { tipo: 'uuid', editavel: false },
      created_at: ts,
    },
  },

  partnership_proposals: {
    tabela: 'partnership_proposals',
    rotulo: 'Propostas recebidas',
    chave: 'id',
    busca: ['brand_name', 'brand_email', 'brand_instagram_handle'],
    ordem: 'created_at desc',
    colunas: {
      id: uuidRO,
      creator_id: { tipo: 'uuid', editavel: false },
      brand_name: { tipo: 'text', editavel: true },
      brand_email: { tipo: 'text', editavel: true, perigoso: true },
      brand_instagram_handle: { tipo: 'text', editavel: true },
      status: { tipo: 'enum', editavel: true, opcoes: ['inbox', 'in_negotiation', 'closed', 'declined', 'auto_declined'] },
      budget_cents: { tipo: 'inteiro', editavel: true, min: 0 },
      decline_reason: { tipo: 'textarea', editavel: true },
      ai_summary: { tipo: 'textarea', editavel: true },
      viewed_at: { tipo: 'ts', editavel: true },
      created_at: ts,
    },
  },

  agency_creators: {
    tabela: 'agency_creators',
    rotulo: 'Carteira de agência',
    chave: 'id',
    busca: ['agency_org_id', 'creator_org_id'],
    ordem: 'created_at desc',
    colunas: {
      id: uuidRO,
      agency_org_id: { tipo: 'uuid', editavel: true, perigoso: true },
      creator_org_id: { tipo: 'uuid', editavel: true, perigoso: true },
      role: { tipo: 'enum', editavel: true, perigoso: true, opcoes: ['owner', 'manager', 'editor', 'viewer'] },
      percentual_padrao: { tipo: 'numero', editavel: true, min: 0, max: 100 },
      created_at: ts,
    },
  },

  creator_links: {
    tabela: 'creator_links',
    rotulo: 'Links da bio',
    chave: 'id',
    busca: ['titulo', 'url', 'user_id'],
    ordem: 'ordem asc',
    colunas: {
      id: uuidRO,
      user_id: { tipo: 'uuid', editavel: false },
      org_id: { tipo: 'uuid', editavel: false },
      titulo: { tipo: 'text', editavel: true },
      url: { tipo: 'text', editavel: true },
      capa_url: { tipo: 'text', editavel: true },
      tipo: { tipo: 'enum', editavel: true, opcoes: ['link', 'divisor'] },
      estilo: { tipo: 'enum', editavel: true, opcoes: ['grande', 'metade', 'metade_alta', 'meio', 'botao'] },
      ordem: { tipo: 'inteiro', editavel: true, min: 0 },
      ativo: { tipo: 'booleano', editavel: true },
      cliques: { tipo: 'inteiro', editavel: false },
      created_at: ts,
    },
  },

  contracts: {
    tabela: 'contracts',
    rotulo: 'Contratos',
    chave: 'id',
    busca: ['titulo', 'signer_name', 'signer_email'],
    ordem: 'created_at desc',
    colunas: {
      id: uuidRO,
      titulo: { tipo: 'text', editavel: true },
      status: { tipo: 'enum', editavel: true, perigoso: true, opcoes: ['rascunho', 'enviado', 'assinado', 'cancelado'] },
      org_id: { tipo: 'uuid', editavel: false },
      campaign_id: { tipo: 'uuid', editavel: true, perigoso: true },
      signer_name: { tipo: 'text', editavel: false },
      signer_email: { tipo: 'text', editavel: false },
      signed_at: { tipo: 'ts', editavel: false, nota: 'Assinatura é fato jurídico. Não se edita daqui.' },
      signed_terms_hash: { tipo: 'text', editavel: false },
      created_at: ts,
    },
  },

  reserved_slugs: {
    tabela: 'reserved_slugs',
    rotulo: 'Slugs reservados',
    chave: 'slug',
    busca: ['slug'],
    ordem: 'slug asc',
    colunas: {
      slug: { tipo: 'text', editavel: false },
    },
  },
}

export function tabelaDoRegistry(nome: string): TabelaAdmin | null {
  return Object.hasOwn(REGISTRY, nome) ? REGISTRY[nome] : null
}

export function camposEditaveis(t: TabelaAdmin): string[] {
  return Object.entries(t.colunas).filter(([, c]) => c.editavel).map(([nome]) => nome)
}
