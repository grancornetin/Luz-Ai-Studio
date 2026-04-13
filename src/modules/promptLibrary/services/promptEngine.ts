import { ReferenceSlot, PromptDNA } from '../types/promptTypes'
import { referenceService } from './referenceService'

type GenerationReference = {
  id: string
  role?: string
  weight: number
  locked: boolean
  imageUrl: string
}

type GenerationPayload = {
  prompt: string
  references: GenerationReference[]
  dna: PromptDNA
}

export const promptEngine = {

  buildGenerationPayload(
    prompt: string,
    slots: ReferenceSlot[]
  ): GenerationPayload {

    const { dna, priorities, locks } =
      referenceService.buildReferenceDNA(slots)

    const references: GenerationReference[] = []

    slots.forEach(slot => {

      if (!slot.imageUrl) return

      references.push({

        id: slot.id,

        role: slot.role,

        imageUrl: slot.imageUrl,

        weight: priorities[slot.id] || 0.6,

        locked: locks.includes(slot.id)

      })

    })

    return {

      prompt,

      references,

      dna

    }

  }

}