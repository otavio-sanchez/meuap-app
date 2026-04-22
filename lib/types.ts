export type PropertyType = 'apartamento' | 'casa' | 'kitnet' | 'cobertura' | 'studio' | 'outros';
export type ItemStatus = 'quero_comprar' | 'pesquisando' | 'comprado' | 'instalado';
export type ItemPriority = 'muito_alta' | 'alta' | 'media' | 'baixa';
export type ItemCategory =
  | 'moveis' | 'eletrodomesticos' | 'decoracao' | 'iluminacao'
  | 'organizacao' | 'eletronicos' | 'reforma' | 'metais' | 'outros';

export interface Property {
  id: string;
  userId: string;
  name: string;
  type: PropertyType;
  area: number;
  roomCount: number;
  description: string;
  address: string;
  isPublic: boolean;
  publicSlug: string | null;
  coverImage: string | null;
  totalBudget: number;
  memberUids: string[];
  members: PropertyMember[];
  inviteEnabled: boolean;
  floorPlanUrl: string | null;
  floorPlanAnnotations: FloorPlanAnnotation[];
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PropertyMember {
  uid: string;
  email: string;
  displayName: string | null;
  role: 'owner' | 'editor';
}

export interface FloorPlanAnnotation {
  roomId: string;
  x: number;
  y: number;
}

export interface FirestoreRoom {
  id: string;
  propertyId: string;
  userId: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  order: number;
  notes: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PriceLink {
  url: string;
  price: number;
  label: string;
}

export interface FirestoreItem {
  id: string;
  roomId: string;
  propertyId: string;
  userId: string;
  name: string;
  description: string;
  category: ItemCategory;
  status: ItemStatus;
  priority: ItemPriority;
  estimatedPrice: number;
  paidPrice: number | null;
  quantity: number;
  store: string | null;
  productUrl: string | null;
  priceLinks: PriceLink[];
  images: string[];
  notes: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export const PROPERTY_TYPES: Record<PropertyType, string> = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  kitnet: 'Kitnet',
  cobertura: 'Cobertura',
  studio: 'Studio',
  outros: 'Outros',
};

export const CATEGORIES: Record<ItemCategory, { label: string; color: string }> = {
  moveis:           { label: 'Móveis',            color: '#C97B2E' },
  eletrodomesticos: { label: 'Eletrodomésticos',  color: '#5B8A72' },
  decoracao:        { label: 'Decoração',          color: '#C45C5C' },
  iluminacao:       { label: 'Iluminação',         color: '#E8A84A' },
  organizacao:      { label: 'Organização',        color: '#7B6FA0' },
  eletronicos:      { label: 'Eletrônicos',        color: '#4A7FA5' },
  reforma:          { label: 'Reforma',            color: '#8A7A5A' },
  metais:           { label: 'Metais',             color: '#6B7280' },
  outros:           { label: 'Outros',             color: '#9CA3AF' },
};

export const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; bg: string; dot: string }> = {
  quero_comprar: { label: 'Quero comprar', color: '#1D4ED8', bg: '#DBEAFE', dot: '#3B82F6' },
  pesquisando:   { label: 'Pesquisando',   color: '#854D0E', bg: '#FEF9C3', dot: '#EAB308' },
  comprado:      { label: 'Comprado',      color: '#166534', bg: '#DCFCE7', dot: '#22C55E' },
  instalado:     { label: 'Instalado',     color: '#FFFFFF', bg: '#14532D', dot: '#16A34A' },
};

export const PRIORITY_CONFIG: Record<ItemPriority, { label: string; color: string }> = {
  muito_alta: { label: 'Muito alta', color: '#7C1D1D' },
  alta:       { label: 'Alta',       color: '#DC2626' },
  media:      { label: 'Média',      color: '#D97706' },
  baixa:      { label: 'Baixa',      color: '#6B7280' },
};

export const STATUS_ORDER: ItemStatus[] = ['quero_comprar', 'pesquisando', 'comprado', 'instalado'];

export const ROOM_TYPES: { type: string; name: string; icon: string; color: string }[] = [
  { type: 'sala',         name: 'Sala de Estar',  icon: '🛋️', color: '#C97B2E' },
  { type: 'quarto',       name: 'Quarto',          icon: '🛏️', color: '#7B6FA0' },
  { type: 'cozinha',      name: 'Cozinha',         icon: '🍳', color: '#5B8A72' },
  { type: 'banheiro',     name: 'Banheiro',        icon: '🚿', color: '#4A7FA5' },
  { type: 'lavanderia',   name: 'Lavanderia',      icon: '🫧', color: '#C45C5C' },
  { type: 'varanda',      name: 'Varanda',         icon: '🌿', color: '#8A7A5A' },
  { type: 'escritorio',   name: 'Escritório',      icon: '💻', color: '#6B7280' },
  { type: 'gourmet',      name: 'Área Gourmet',    icon: '🍖', color: '#B45309' },
  { type: 'quarto_filho', name: 'Quarto de Filho', icon: '🧸', color: '#EC4899' },
  { type: 'personalizado',name: 'Personalizado',   icon: '✏️', color: '#8B5CF6' },
];

export const ROOM_SUGGESTIONS: Record<string, Array<{ name: string; category: ItemCategory; priority: ItemPriority; estimatedPrice?: number }>> = {
  sala: [
    { name: 'Sofá',                   category: 'moveis',           priority: 'alta',  estimatedPrice: 3000 },
    { name: 'Mesa de centro',         category: 'moveis',           priority: 'media', estimatedPrice: 500 },
    { name: 'TV',                     category: 'eletronicos',      priority: 'alta',  estimatedPrice: 2500 },
    { name: 'Rack / Painel TV',       category: 'moveis',           priority: 'media', estimatedPrice: 800 },
    { name: 'Tapete',                 category: 'decoracao',        priority: 'baixa', estimatedPrice: 400 },
    { name: 'Ar-condicionado',        category: 'eletrodomesticos', priority: 'alta',  estimatedPrice: 2200 },
    { name: 'Cortinas',               category: 'decoracao',        priority: 'media', estimatedPrice: 600 },
  ],
  quarto: [
    { name: 'Cama + colchão',         category: 'moveis',           priority: 'alta',  estimatedPrice: 3500 },
    { name: 'Guarda-roupa',           category: 'moveis',           priority: 'alta',  estimatedPrice: 2500 },
    { name: 'Criado-mudo',            category: 'moveis',           priority: 'media', estimatedPrice: 400 },
    { name: 'Espelho',                category: 'decoracao',        priority: 'media', estimatedPrice: 300 },
    { name: 'Ar-condicionado',        category: 'eletrodomesticos', priority: 'alta',  estimatedPrice: 2200 },
  ],
  cozinha: [
    { name: 'Geladeira',              category: 'eletrodomesticos', priority: 'alta',  estimatedPrice: 3000 },
    { name: 'Fogão',                  category: 'eletrodomesticos', priority: 'alta',  estimatedPrice: 1200 },
    { name: 'Micro-ondas',            category: 'eletrodomesticos', priority: 'media', estimatedPrice: 600 },
    { name: 'Mesa de jantar',         category: 'moveis',           priority: 'alta',  estimatedPrice: 2000 },
    { name: 'Cadeiras (jogo)',        category: 'moveis',           priority: 'alta',  estimatedPrice: 1200 },
  ],
  banheiro: [
    { name: 'Espelho',                category: 'decoracao',        priority: 'alta',  estimatedPrice: 200 },
    { name: 'Armário de banheiro',    category: 'moveis',           priority: 'media', estimatedPrice: 600 },
    { name: 'Toalheiro',              category: 'metais',           priority: 'media', estimatedPrice: 150 },
  ],
  lavanderia: [
    { name: 'Máquina de lavar',       category: 'eletrodomesticos', priority: 'alta',  estimatedPrice: 2500 },
    { name: 'Varal',                  category: 'organizacao',      priority: 'media', estimatedPrice: 150 },
  ],
  escritorio: [
    { name: 'Mesa de trabalho',       category: 'moveis',           priority: 'alta',  estimatedPrice: 800 },
    { name: 'Cadeira ergonômica',     category: 'moveis',           priority: 'alta',  estimatedPrice: 1500 },
    { name: 'Monitor',                category: 'eletronicos',      priority: 'media', estimatedPrice: 1500 },
  ],
};

export type MoveTaskCategory = 'documentos' | 'logistica' | 'servicos' | 'banco' | 'contatos' | 'outros';

export interface MoveTask {
  id: string;
  propertyId: string;
  userId: string;
  text: string;
  done: boolean;
  category: MoveTaskCategory;
  createdAt: unknown;
  updatedAt: unknown;
}

export const MOVE_TASK_CATEGORIES: Record<MoveTaskCategory, { label: string; icon: string; color: string }> = {
  documentos: { label: 'Documentos', icon: '📄', color: '#4A7FA5' },
  logistica:  { label: 'Logística',  icon: '🚛', color: '#8A7A5A' },
  servicos:   { label: 'Serviços',   icon: '⚡', color: '#E8A84A' },
  banco:      { label: 'Banco',      icon: '🏦', color: '#5B8A72' },
  contatos:   { label: 'Contatos',   icon: '📞', color: '#7B6FA0' },
  outros:     { label: 'Outros',     icon: '📋', color: '#9CA3AF' },
};

export const DEFAULT_MOVE_TASKS: Array<{ text: string; category: MoveTaskCategory }> = [
  { text: 'Atualizar endereço na CNH',                 category: 'documentos' },
  { text: 'Comunicar mudança à Receita Federal',       category: 'documentos' },
  { text: 'Avisar os Correios sobre nova morada',      category: 'documentos' },
  { text: 'Atualizar título de eleitor',               category: 'documentos' },
  { text: 'Contratar transportadora / caminhão',       category: 'logistica'  },
  { text: 'Embalar pertences por cômodo (etiquetar)',  category: 'logistica'  },
  { text: 'Reservar elevador de serviço (condomínio)', category: 'logistica'  },
  { text: 'Descartar ou doar itens que não irão',      category: 'logistica'  },
  { text: 'Transferir conta de energia elétrica',      category: 'servicos'   },
  { text: 'Transferir conta de gás',                   category: 'servicos'   },
  { text: 'Cancelar ou transferir plano de internet',  category: 'servicos'   },
  { text: 'Atualizar endereço no banco',               category: 'banco'      },
  { text: 'Atualizar endereço nos cartões de crédito', category: 'banco'      },
  { text: 'Avisar escola / creche das crianças',       category: 'contatos'   },
  { text: 'Atualizar endereço no plano de saúde',      category: 'contatos'   },
  { text: 'Comunicar mudança a amigos e família',      category: 'contatos'   },
];
