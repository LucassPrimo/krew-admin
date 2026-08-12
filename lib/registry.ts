import type { TipoPii } from './pii'

/**
 * O registry — §6 do plano.
 *
 * Este arquivo é a diferença entre um painel administrativo e um `UPDATE` solto
 * numa aba do navegador. Nada é editável por ser uma coluna do banco; é
 * editável por estar declarado aqui, com tipo, com limites e com o aviso de
 * quando a mudança tem consequência.
 *
 * O que o registry entrega de graça, para toda tabela que entra: listagem com
 * busca, formulário tipado, validação, diff antes de confirmar e auditoria.
 * Nenhuma tela precisa lembrar de fazer nada disso.
 *
 * Tabela que não está aqui continua VISÍVEL no explorador (leitura sai da
 * introspecção do banco) e permanece INTOCÁVEL. Coluna que não está aqui, o
 * mesmo. Fica de fora até alguém decidir o contrário — a checagem de
 * integridade avisa o que ficou para trás.
 *
 * Os `opcoes` de cada enum são cópia literal dos CHECK constraints do banco
 * (conferidos em 12/08/2026). Se divergirem, quem ganha é o banco: o update
 * falha na constraint e a transação volta atrás. O registry erra para o lado de
 * mostrar opção a menos, nunca de gravar valor inválido.
 */

export type TipoCampo =
  | 'text'
  | 'textarea'
  | 'number'
  | 'money'
  | 'percent'
  | 'date'
  | 'timestamp'
  | 'bool'
  | 'uuid'
  | 'enum'
  | 'json'
  | 'array'

export interface Coluna {
  tipo: TipoCampo
  rotulo?: string
  /** Fora daqui, `false` é o default em todo lugar. Editar é a exceção. */
  editavel?: boolean
  opcoes?: readonly string[]
  min?: number
  max?: number
  /** Mascarado na tela; revelar é ação auditada (§9). */
  pii?: TipoPii
  /**
   * Mudança com consequência que não cabe num "ok": troca de dono, dinheiro,
   * status financeiro. Exige digitar um texto de confirmação.
   */
  perigoso?: boolean
  nota?: string
}

export interface TabelaAdmin {
  tabela: string
  rotulo: string
  /** Coluna de chave primária. Todo update é `where <chave> = $1`, uma linha. */
  chave: string
  descricao?: string
  /** Colunas varridas pela busca em texto. */
  busca?: readonly string[]
  ordemPadrao?: string
  /** Como esta tabela se liga a uma org e a uma pessoa — usado na visão 360. */
  colunaOrg?: string
  colunaUsuario?: string
  colunas: Record<string, Coluna>
}

const ID: Coluna = { tipo: 'uuid', rotulo: 'ID' }
const CRIADO: Coluna = { tipo: 'timestamp', rotulo: 'Criado em' }

export const REGISTRY: Record<string, TabelaAdmin> = {
  profiles: {
    tabela: 'profiles',
    rotulo: 'Perfis',
    chave: 'id',
    descricao: 'Dados pessoais do creator. 1:1 com auth.users.',
    busca: ['full_name', 'sobrenome', 'cidade', 'nicho'],
    ordemPadrao: 'created_at desc',
    colunaUsuario: 'id',
    colunas: {
      id: ID,
      full_name: { tipo: 'text', rotulo: 'Nome', editavel: true },
      sobrenome: { tipo: 'text', rotulo: 'Sobrenome', editavel: true },
      avatar_url: { tipo: 'text', rotulo: 'Avatar', editavel: true },
      nicho: { tipo: 'text', rotulo: 'Nicho', editavel: true },
      cidade: { tipo: 'text', rotulo: 'Cidade', editavel: true },
      estado: { tipo: 'text', rotulo: 'UF', editavel: true, max: 2 },
      whatsapp: { tipo: 'text', rotulo: 'WhatsApp', editavel: true, pii: 'telefone' },
      tipo_pessoa: {
        tipo: 'enum',
        rotulo: 'Tipo de pessoa',
        editavel: true,
        opcoes: ['MEI', 'PJ', 'PF'],
        nota: 'Muda o cálculo de imposto do creator inteiro.',
      },
      cpf_cnpj: {
        tipo: 'text',
        rotulo: 'CPF/CNPJ',
        editavel: true,
        pii: 'documento',
        perigoso: true,
        nota: 'Documento fiscal. Confira com a pessoa antes de alterar.',
      },
      dados_bancarios: {
        tipo: 'json',
        rotulo: 'Dados bancários',
        editavel: true,
        pii: 'bancario',
        perigoso: true,
        nota: 'É para onde o dinheiro dela vai. Nunca altere sem confirmação direta do titular.',
      },
      iss_aliquota: { tipo: 'percent', rotulo: 'Alíquota ISS', editavel: true, min: 0, max: 5 },
      account_type: {
        tipo: 'enum',
        rotulo: 'Tipo de conta',
        editavel: true,
        opcoes: ['creator', 'agency'],
        perigoso: true,
        nota: 'Troca o app inteiro que a pessoa vê (dashboard ↔ /agencia).',
      },
      onboarding_step: {
        tipo: 'number',
        rotulo: 'Passo do onboarding',
        editavel: true,
        min: 0,
        max: 3,
        nota: 'Abaixo de 3, o proxy do app empurra a pessoa de volta pro wizard.',
      },
      onboarding_data: { tipo: 'json', rotulo: 'Respostas do onboarding' },
      created_at: CRIADO,
    },
  },

  organizations: {
    tabela: 'organizations',
    rotulo: 'Organizações',
    chave: 'id',
    descricao: 'A unidade de posse de todo dado do app.',
    busca: ['name'],
    ordemPadrao: 'created_at desc',
    colunas: {
      id: ID,
      name: { tipo: 'text', rotulo: 'Nome', editavel: true },
      tipo: { tipo: 'enum', rotulo: 'Tipo', editavel: true, opcoes: ['creator', 'agency'], perigoso: true },
      owner_user_id: { tipo: 'uuid', rotulo: 'Dono', perigoso: true },
      created_at: CRIADO,
    },
  },

  memberships: {
    tabela: 'memberships',
    rotulo: 'Membros',
    chave: 'id',
    descricao: 'Quem pertence a qual org, e com que poder.',
    ordemPadrao: 'created_at desc',
    colunaOrg: 'org_id',
    colunaUsuario: 'user_id',
    colunas: {
      id: ID,
      org_id: { tipo: 'uuid', rotulo: 'Org' },
      user_id: { tipo: 'uuid', rotulo: 'Usuário' },
      role: {
        tipo: 'enum',
        rotulo: 'Papel',
        editavel: true,
        opcoes: ['owner', 'manager', 'editor', 'accountant', 'viewer'],
        perigoso: true,
        nota: 'Define o que essa pessoa pode fazer com os dados da org.',
      },
      created_at: CRIADO,
    },
  },

  agency_creators: {
    tabela: 'agency_creators',
    rotulo: 'Carteira de agências',
    chave: 'id',
    descricao: 'Vínculo entre a org da agência e a org do creator.',
    ordemPadrao: 'created_at desc',
    colunas: {
      id: ID,
      agency_org_id: { tipo: 'uuid', rotulo: 'Agência' },
      creator_org_id: { tipo: 'uuid', rotulo: 'Creator' },
      role: {
        tipo: 'enum',
        rotulo: 'Poder da agência',
        editavel: true,
        opcoes: ['manager', 'editor', 'accountant', 'viewer'],
        perigoso: true,
      },
      percentual_padrao: { tipo: 'percent', rotulo: 'Comissão padrão', editavel: true, min: 0, max: 100 },
      created_at: CRIADO,
    },
  },

  brands: {
    tabela: 'brands',
    rotulo: 'Marcas',
    chave: 'id',
    busca: ['nome', 'cnpj', 'website'],
    ordemPadrao: 'created_at desc',
    colunaOrg: 'org_id',
    colunaUsuario: 'user_id',
    colunas: {
      id: ID,
      nome: { tipo: 'text', rotulo: 'Nome', editavel: true },
      cnpj: { tipo: 'text', rotulo: 'CNPJ', editavel: true, pii: 'documento' },
      website: { tipo: 'text', rotulo: 'Site', editavel: true },
      sector: { tipo: 'text', rotulo: 'Setor', editavel: true },
      notas: { tipo: 'textarea', rotulo: 'Notas', editavel: true },
      org_id: { tipo: 'uuid', rotulo: 'Org', editavel: true, perigoso: true, nota: 'Move a marca de carteira.' },
      user_id: { tipo: 'uuid', rotulo: 'Autor' },
      created_at: CRIADO,
    },
  },

  deals: {
    tabela: 'deals',
    rotulo: 'Negociações',
    chave: 'id',
    busca: ['titulo', 'proximo_passo'],
    ordemPadrao: 'created_at desc',
    colunaOrg: 'org_id',
    colunaUsuario: 'user_id',
    colunas: {
      id: ID,
      titulo: { tipo: 'text', rotulo: 'Título', editavel: true },
      stage: {
        tipo: 'enum',
        rotulo: 'Estágio',
        editavel: true,
        opcoes: ['lead', 'em_negociacao', 'proposta_enviada', 'fechado_ganho', 'fechado_perdido'],
        nota: 'Mover para fechado_ganho dispara o trigger que cria a campanha.',
        perigoso: true,
      },
      valor_estimado: { tipo: 'money', rotulo: 'Valor estimado', editavel: true, min: 0 },
      data_prevista_fechamento: { tipo: 'date', rotulo: 'Previsão', editavel: true },
      proximo_passo: { tipo: 'text', rotulo: 'Próximo passo', editavel: true },
      notas: { tipo: 'textarea', rotulo: 'Notas', editavel: true },
      brand_id: { tipo: 'uuid', rotulo: 'Marca', editavel: true },
      org_id: { tipo: 'uuid', rotulo: 'Org', editavel: true, perigoso: true },
      user_id: { tipo: 'uuid', rotulo: 'Autor' },
      created_at: CRIADO,
      updated_at: { tipo: 'timestamp', rotulo: 'Atualizado em' },
    },
  },

  campaigns: {
    tabela: 'campaigns',
    rotulo: 'Campanhas',
    chave: 'id',
    busca: ['nome', 'notas'],
    ordemPadrao: 'created_at desc',
    colunaOrg: 'org_id',
    colunaUsuario: 'user_id',
    colunas: {
      id: ID,
      nome: { tipo: 'text', rotulo: 'Nome', editavel: true },
      status: {
        tipo: 'enum',
        rotulo: 'Status',
        editavel: true,
        opcoes: ['ativa', 'concluida', 'cancelada'],
      },
      valor_total: { tipo: 'money', rotulo: 'Valor total', editavel: true, min: 0, perigoso: true },
      eh_permuta: { tipo: 'bool', rotulo: 'É permuta', editavel: true },
      data_inicio: { tipo: 'date', rotulo: 'Início', editavel: true },
      data_fim: { tipo: 'date', rotulo: 'Fim', editavel: true },
      notas: { tipo: 'textarea', rotulo: 'Notas', editavel: true },
      brand_id: { tipo: 'uuid', rotulo: 'Marca', editavel: true },
      deal_id: { tipo: 'uuid', rotulo: 'Negociação' },
      share_token: {
        tipo: 'uuid',
        rotulo: 'Token público',
        nota: 'Link que a marca usa para aprovar entregas. Regenerar é ação, não edição.',
      },
      org_id: { tipo: 'uuid', rotulo: 'Org', editavel: true, perigoso: true },
      user_id: { tipo: 'uuid', rotulo: 'Autor' },
      created_at: CRIADO,
    },
  },

  deliverables: {
    tabela: 'deliverables',
    rotulo: 'Entregáveis',
    chave: 'id',
    busca: ['titulo', 'roteiro'],
    ordemPadrao: 'created_at desc',
    colunas: {
      id: ID,
      campaign_id: { tipo: 'uuid', rotulo: 'Campanha' },
      titulo: { tipo: 'text', rotulo: 'Título', editavel: true },
      tipo: {
        tipo: 'enum',
        rotulo: 'Formato',
        editavel: true,
        opcoes: ['Reels', 'Stories', 'TikTok', 'YouTube', 'Post', 'Outro'],
      },
      status: {
        tipo: 'enum',
        rotulo: 'Status',
        editavel: true,
        opcoes: ['a_gravar', 'em_aprovacao', 'aprovado', 'reprovado', 'postado'],
      },
      roteiro_status: {
        tipo: 'enum',
        rotulo: 'Status do roteiro',
        editavel: true,
        opcoes: ['rascunho', 'em_aprovacao', 'aprovado', 'ajustes'],
      },
      data_prazo: { tipo: 'date', rotulo: 'Prazo', editavel: true },
      link: { tipo: 'text', rotulo: 'Link do post', editavel: true },
      roteiro: { tipo: 'textarea', rotulo: 'Roteiro', editavel: true },
      roteiro_feedback: { tipo: 'textarea', rotulo: 'Feedback', editavel: true },
      checklist: { tipo: 'json', rotulo: 'Checklist' },
      roteiro_revisado_em: { tipo: 'timestamp', rotulo: 'Revisado em' },
      created_at: CRIADO,
    },
  },

  receivables: {
    tabela: 'receivables',
    rotulo: 'Recebíveis',
    chave: 'id',
    busca: ['descricao'],
    ordemPadrao: 'data_prevista desc',
    colunaOrg: 'org_id',
    colunas: {
      id: ID,
      descricao: { tipo: 'text', rotulo: 'Descrição', editavel: true },
      valor: { tipo: 'money', rotulo: 'Valor', editavel: true, min: 0, perigoso: true },
      valor_liquido: { tipo: 'money', rotulo: 'Valor líquido', editavel: true, min: 0, perigoso: true },
      status: {
        tipo: 'enum',
        rotulo: 'Status',
        editavel: true,
        opcoes: ['pendente', 'pago', 'atrasado'],
        perigoso: true,
        nota: 'Marcar como pago sem o dinheiro ter entrado desalinha o financeiro do cliente.',
      },
      data_prevista: { tipo: 'date', rotulo: 'Previsão', editavel: true },
      data_pagamento: { tipo: 'date', rotulo: 'Pagamento', editavel: true },
      retencoes: { tipo: 'json', rotulo: 'Retenções', editavel: true },
      campaign_id: { tipo: 'uuid', rotulo: 'Campanha' },
      income_source_id: { tipo: 'uuid', rotulo: 'Fonte de renda' },
      org_id: { tipo: 'uuid', rotulo: 'Org', editavel: true, perigoso: true },
      created_at: CRIADO,
    },
  },

  expenses: {
    tabela: 'expenses',
    rotulo: 'Despesas',
    chave: 'id',
    busca: ['descricao'],
    ordemPadrao: 'data desc',
    colunaOrg: 'org_id',
    colunaUsuario: 'user_id',
    colunas: {
      id: ID,
      descricao: { tipo: 'text', rotulo: 'Descrição', editavel: true },
      categoria: {
        tipo: 'enum',
        rotulo: 'Categoria',
        editavel: true,
        opcoes: ['producao', 'equipamentos', 'equipe', 'ferramentas', 'impostos', 'outros'],
      },
      valor: { tipo: 'money', rotulo: 'Valor', editavel: true, min: 0 },
      data: { tipo: 'date', rotulo: 'Data', editavel: true },
      comprovante_path: { tipo: 'text', rotulo: 'Comprovante' },
      org_id: { tipo: 'uuid', rotulo: 'Org', editavel: true, perigoso: true },
      user_id: { tipo: 'uuid', rotulo: 'Autor' },
      created_at: CRIADO,
    },
  },

  partnership_proposals: {
    tabela: 'partnership_proposals',
    rotulo: 'Propostas recebidas',
    chave: 'id',
    busca: ['brand_name', 'brand_email', 'contact_name', 'brand_instagram_handle'],
    ordemPadrao: 'created_at desc',
    colunaUsuario: 'creator_id',
    colunas: {
      id: ID,
      creator_id: { tipo: 'uuid', rotulo: 'Creator' },
      brand_name: { tipo: 'text', rotulo: 'Marca', editavel: true },
      brand_email: { tipo: 'text', rotulo: 'E-mail da marca', editavel: true, pii: 'email' },
      brand_instagram_handle: { tipo: 'text', rotulo: 'Instagram', editavel: true },
      brand_cnpj: { tipo: 'text', rotulo: 'CNPJ', editavel: true, pii: 'documento' },
      brand_website: { tipo: 'text', rotulo: 'Site', editavel: true },
      brand_sector: { tipo: 'text', rotulo: 'Setor', editavel: true },
      contact_name: { tipo: 'text', rotulo: 'Contato', editavel: true },
      contact_phone: { tipo: 'text', rotulo: 'Telefone', editavel: true, pii: 'telefone' },
      type: { tipo: 'enum', rotulo: 'Tipo', editavel: true, opcoes: ['paid', 'seeding'] },
      status: {
        tipo: 'enum',
        rotulo: 'Status',
        editavel: true,
        opcoes: ['inbox', 'in_negotiation', 'closed', 'declined', 'auto_declined'],
      },
      budget_cents: { tipo: 'number', rotulo: 'Orçamento (centavos)', editavel: true, min: 0 },
      decline_reason: { tipo: 'textarea', rotulo: 'Motivo da recusa', editavel: true },
      pitch_text: { tipo: 'textarea', rotulo: 'Pitch' },
      deliverables: { tipo: 'json', rotulo: 'Entregáveis pedidos' },
      shipping_address: { tipo: 'json', rotulo: 'Endereço de envio', pii: 'documento' },
      usage_rights: { tipo: 'array', rotulo: 'Direitos de uso' },
      usage_period_months: { tipo: 'number', rotulo: 'Período de uso (meses)', editavel: true, min: 0 },
      ai_summary: { tipo: 'textarea', rotulo: 'Resumo IA' },
      tracking_token: { tipo: 'uuid', rotulo: 'Token de rastreio' },
      viewed_at: { tipo: 'timestamp', rotulo: 'Visto em' },
      response_sent_at: { tipo: 'timestamp', rotulo: 'Respondida em' },
      created_at: CRIADO,
    },
  },

  proposal_pages: {
    tabela: 'proposal_pages',
    rotulo: 'Páginas públicas',
    chave: 'id',
    busca: ['slug', 'title_text'],
    ordemPadrao: 'created_at desc',
    colunaOrg: 'org_id',
    colunaUsuario: 'user_id',
    colunas: {
      id: ID,
      slug: {
        tipo: 'text',
        rotulo: 'Slug',
        editavel: true,
        perigoso: true,
        nota: 'É o endereço público do creator. Mudar quebra todo link já divulgado.',
      },
      availability_status: {
        tipo: 'enum',
        rotulo: 'Disponibilidade',
        editavel: true,
        opcoes: ['open', 'limited', 'closed'],
      },
      availability_note: { tipo: 'text', rotulo: 'Aviso', editavel: true },
      min_budget_cents: { tipo: 'number', rotulo: 'Orçamento mínimo (centavos)', editavel: true, min: 0 },
      welcome_message: { tipo: 'textarea', rotulo: 'Boas-vindas', editavel: true },
      title_text: { tipo: 'text', rotulo: 'Título', editavel: true },
      theme: { tipo: 'enum', rotulo: 'Tema', editavel: true, opcoes: ['light', 'dark'] },
      form_font: {
        tipo: 'enum', rotulo: 'Fonte do form', editavel: true,
        opcoes: ['sans', 'display', 'mono', 'poppins', 'playfair', 'grotesk'],
      },
      title_font: {
        tipo: 'enum', rotulo: 'Fonte do título', editavel: true,
        opcoes: ['sans', 'display', 'mono', 'poppins', 'playfair', 'grotesk'],
      },
      form_color: { tipo: 'text', rotulo: 'Cor do form', editavel: true },
      bg_color: { tipo: 'text', rotulo: 'Cor de fundo', editavel: true },
      border_style: { tipo: 'enum', rotulo: 'Bordas', editavel: true, opcoes: ['rounded', 'square'] },
      locale: { tipo: 'enum', rotulo: 'Idioma', editavel: true, opcoes: ['pt-BR', 'en-US', 'es-ES'] },
      org_id: { tipo: 'uuid', rotulo: 'Org' },
      user_id: { tipo: 'uuid', rotulo: 'Creator' },
      created_at: CRIADO,
    },
  },

  contracts: {
    tabela: 'contracts',
    rotulo: 'Contratos',
    chave: 'id',
    busca: ['titulo', 'signer_name', 'signer_email'],
    ordemPadrao: 'created_at desc',
    colunaOrg: 'org_id',
    colunas: {
      id: ID,
      titulo: { tipo: 'text', rotulo: 'Título', editavel: true },
      status: {
        tipo: 'enum',
        rotulo: 'Status',
        editavel: true,
        opcoes: ['rascunho', 'enviado', 'assinado', 'cancelado'],
        perigoso: true,
        nota: 'Contrato assinado é registro jurídico. Mudar status depois da assinatura precisa de motivo muito bom.',
      },
      campaign_id: { tipo: 'uuid', rotulo: 'Campanha' },
      brand_id: { tipo: 'uuid', rotulo: 'Marca' },
      territory: { tipo: 'text', rotulo: 'Território', editavel: true },
      usage_rights: { tipo: 'array', rotulo: 'Direitos de uso' },
      usage_period_months: { tipo: 'number', rotulo: 'Período (meses)', editavel: true, min: 0 },
      exclusivity_category: { tipo: 'text', rotulo: 'Exclusividade', editavel: true },
      exclusivity_months: { tipo: 'number', rotulo: 'Exclusividade (meses)', editavel: true, min: 0 },
      whitelisting: { tipo: 'bool', rotulo: 'Whitelisting', editavel: true },
      boosting_budget_cents: { tipo: 'number', rotulo: 'Verba de impulsionamento', editavel: true, min: 0 },
      multa_atraso_percentual: { tipo: 'percent', rotulo: 'Multa por atraso', editavel: true, min: 0 },
      juros_mes_percentual: { tipo: 'percent', rotulo: 'Juros ao mês', editavel: true, min: 0 },
      // Prova de assinatura. Nada aqui é editável: alterar é adulterar prova.
      signer_name: { tipo: 'text', rotulo: 'Assinado por' },
      signer_email: { tipo: 'text', rotulo: 'E-mail do signatário', pii: 'email' },
      signer_ip: { tipo: 'text', rotulo: 'IP da assinatura' },
      signer_user_agent: { tipo: 'text', rotulo: 'Navegador' },
      signed_terms_hash: { tipo: 'text', rotulo: 'Hash dos termos' },
      signed_at: { tipo: 'timestamp', rotulo: 'Assinado em' },
      signing_token: { tipo: 'uuid', rotulo: 'Token de assinatura' },
      arquivo_path: { tipo: 'text', rotulo: 'Arquivo' },
      org_id: { tipo: 'uuid', rotulo: 'Org' },
      created_at: CRIADO,
    },
  },

  subscriptions: {
    tabela: 'subscriptions',
    rotulo: 'Assinaturas',
    chave: 'user_id',
    descricao:
      'Espelho de Stripe. Só `trial_ends_at` é editável — o resto é sobrescrito pelo próximo webhook.',
    ordemPadrao: 'updated_at desc',
    colunaUsuario: 'user_id',
    colunas: {
      user_id: { tipo: 'uuid', rotulo: 'Pessoa' },
      stripe_customer_id: { tipo: 'text', rotulo: 'Cliente Stripe' },
      stripe_subscription_id: { tipo: 'text', rotulo: 'Assinatura Stripe' },
      status: { tipo: 'text', rotulo: 'Status (Stripe)' },
      price_id: { tipo: 'text', rotulo: 'Price' },
      current_period_end: { tipo: 'timestamp', rotulo: 'Período paga até' },
      cancel_at_period_end: { tipo: 'bool', rotulo: 'Cancela ao fim do período' },
      trial_ends_at: {
        tipo: 'timestamp',
        rotulo: 'Trial até',
        editavel: true,
        nota:
          'Único campo que o webhook do Stripe nunca sobrescreve — é o que dá acesso sem passar pela cobrança.',
      },
      updated_at: { tipo: 'timestamp', rotulo: 'Atualizado em' },
    },
  },

  invoices: {
    tabela: 'invoices',
    rotulo: 'Notas fiscais',
    chave: 'id',
    busca: ['numero', 'tomador_nome', 'tomador_cnpj'],
    ordemPadrao: 'data_emissao desc',
    colunaOrg: 'org_id',
    colunas: {
      id: ID,
      numero: { tipo: 'text', rotulo: 'Número', editavel: true },
      data_emissao: { tipo: 'date', rotulo: 'Emissão', editavel: true },
      tomador_nome: { tipo: 'text', rotulo: 'Tomador', editavel: true },
      tomador_cnpj: { tipo: 'text', rotulo: 'CNPJ do tomador', editavel: true, pii: 'documento' },
      descricao_servico: { tipo: 'textarea', rotulo: 'Descrição', editavel: true },
      valor_bruto: { tipo: 'money', rotulo: 'Valor bruto', editavel: true, min: 0.01, perigoso: true },
      status: {
        tipo: 'enum',
        rotulo: 'Status',
        editavel: true,
        opcoes: ['emitida', 'cancelada', 'substituida'],
        perigoso: true,
      },
      receivable_id: { tipo: 'uuid', rotulo: 'Recebível' },
      arquivo_pdf_path: { tipo: 'text', rotulo: 'PDF' },
      arquivo_xml_path: { tipo: 'text', rotulo: 'XML' },
      org_id: { tipo: 'uuid', rotulo: 'Org' },
      created_at: CRIADO,
    },
  },
}

export function tabelaDoRegistry(nome: string): TabelaAdmin | null {
  return REGISTRY[nome] ?? null
}

/**
 * A pergunta que o executor de escrita faz antes de qualquer `UPDATE`.
 * Só responde `true` para coluna declarada E marcada como editável.
 */
export function colunaEditavel(tabela: string, coluna: string): boolean {
  return REGISTRY[tabela]?.colunas[coluna]?.editavel === true
}
