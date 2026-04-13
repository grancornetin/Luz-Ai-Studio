const STORAGE_KEY = "prompt_library"

export interface StoredPrompt {
  id: string
  name: string
  rawPrompt: string
  dna: any
  createdAt: number
  usageCount: number
  favorite: boolean
}

export const promptLibraryService = {
  getAll(): StoredPrompt[] {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  },

  save(prompt: StoredPrompt) {
    const prompts = this.getAll()

    const exists = prompts.find(p => p.rawPrompt === prompt.rawPrompt)

    if (exists) {
      exists.usageCount++
    } else {
      prompts.push(prompt)
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts))
  },

  delete(id: string) {
    const prompts = this.getAll().filter(p => p.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts))
  },

  toggleFavorite(id: string) {
    const prompts = this.getAll().map(p =>
      p.id === id ? { ...p, favorite: !p.favorite } : p
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts))
  }
}