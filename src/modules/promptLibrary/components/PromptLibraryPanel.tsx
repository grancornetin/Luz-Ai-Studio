import { useEffect, useState } from "react"
import { promptLibraryService } from "../services/promptLibraryService"

interface Props {
  onSelectPrompt: (prompt: string) => void
}

export default function PromptLibraryPanel({ onSelectPrompt }: Props) {
  const [prompts, setPrompts] = useState<any[]>([])

  const loadPrompts = () => {
    const data = promptLibraryService.getAll()
    setPrompts(data)
  }

  useEffect(() => {
    loadPrompts()
  }, [])

  return (
    <div className="space-y-4">

      <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
        Prompt Library
      </h3>

      {prompts.length === 0 && (
        <p className="text-xs text-slate-400">
          No saved prompts yet
        </p>
      )}

      {prompts.map(p => (
        <div
          key={p.id}
          className="border border-slate-100 rounded-2xl p-4 flex flex-col gap-2"
        >
          <p className="text-xs font-bold text-slate-700 truncate">
            {p.name}
          </p>

          <p className="text-[10px] text-slate-400 line-clamp-2">
            {p.rawPrompt}
          </p>

          <div className="flex items-center gap-2 mt-2">

            <button
              onClick={() => onSelectPrompt(p.rawPrompt)}
              className="text-[10px] font-bold text-brand-600"
            >
              Use
            </button>

            <button
              onClick={() => {
                promptLibraryService.delete(p.id)
                loadPrompts()
              }}
              className="text-[10px] text-slate-400"
            >
              Delete
            </button>

            <button
              onClick={() => {
                promptLibraryService.toggleFavorite(p.id)
                loadPrompts()
              }}
              className="text-[10px]"
            >
              {p.favorite ? "★" : "☆"}
            </button>

          </div>

        </div>
      ))}

    </div>
  )
}