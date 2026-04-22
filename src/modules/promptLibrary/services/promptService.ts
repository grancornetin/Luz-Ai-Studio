// ==============================
// 🧬 PROMPT DNA
// ==============================
export type PersonLayer = {
  role?: string
  base: string
  attributes: string[]
}

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
// 💬 COMMENT
// ==============================
export type PromptComment = {
  id: string
  promptId: string
  authorId: string
  authorName: string
  authorPhotoURL?: string
  text: string
  createdAt: string
}

// ==============================
// 📌 BOARD (like Pinterest boards)
// ==============================
export type PromptBoard = {
  id: string
  ownerId: string
  name: string
  description?: string
  coverImageUrl?: string
  promptIds: string[]
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

// ==============================
// 📦 PROMPT ENTITY (Global)
// ==============================
export type Prompt = {
  id: string
  title: string
  promptText: string
  promptDNA: PromptDNA
  imageUrl: string
  authorId: string
  authorName?: string
  authorPhotoURL?: string
  tags: string[]
  likes: number
  likedBy: string[]          // UIDs that have liked — prevents double-like
  saves: number              // how many users saved/bookmarked it
  commentsCount: number
  createdAt: string

  // Variations / lineage
  originPromptId?: string
  generations?: PromptGeneration[]

  // Visibility
  isPublic: boolean          // true = appears in global gallery
  isPrivate?: boolean        // true = only visible to owner

  // Moderation
  reportedBy?: string[]      // UIDs that reported
  isFlagged?: boolean        // admin-set
}

// ==============================
// 🔖 SAVED PROMPT (user's personal saves)
// Collection: users/{uid}/savedPrompts/{promptId}
// ==============================
export type SavedPrompt = {
  promptId: string
  boardId?: string           // optional: which board it belongs to
  savedAt: string
}

// ==============================
// 🧩 REFERENCES
// ==============================
export type ReferenceType = 'product' | 'person' | 'style'
export type ReferencePriority = 'low' | 'medium' | 'high'
export type ReferenceRole =
  | 'person1' | 'person2' | 'person3' | 'person4'
  | 'product1' | 'product2' | 'product3' | 'product4'
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