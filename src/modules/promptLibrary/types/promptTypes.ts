export type PersonLayer = {
  role?: string
  base: string
  attributes: string[]
}

// ==============================
// 🧬 PROMPT DNA
// ==============================
export type PromptDNA = {
  persons?: string[]
  personLayers?: PersonLayer[]

  products?: string[]
  styles?: string[]
  lighting?: string[]
  background?: string[]
  composition?: string[]
  details?: string[]
}

// ==============================
// 🖼️ PROMPT GENERATION
// ==============================
export type PromptGeneration = {
  id: string
  imageUrl: string
  promptText: string
  promptDNA: PromptDNA
  authorId: string
  createdAt: string
}

// ==============================
// 📦 PROMPT ENTITY
// ==============================
export type Prompt = {
  id: string
  title: string
  promptText: string
  promptDNA: PromptDNA
  imageUrl: string
  authorId: string
  tags: string[]
  likes: number
  createdAt: string

  // 🔥 Sprint 3
  originPromptId?: string
  generations?: PromptGeneration[]
}

// ==============================
// 🧩 REFERENCES
// ==============================
export type ReferenceType =
  | 'product'
  | 'person'
  | 'style'

export type ReferencePriority =
  | 'low'
  | 'medium'
  | 'high'

export type ReferenceRole =
  | 'person1'
  | 'person2'
  | 'person3'
  | 'person4'
  | 'product1'
  | 'product2'
  | 'product3'
  | 'product4'
  | 'style1'

export interface ReferenceSlot {
  id: string
  type: ReferenceType
  role?: ReferenceRole
  imageUrl: string | null
  label: string
  priority?: ReferencePriority
  locked?: boolean
}