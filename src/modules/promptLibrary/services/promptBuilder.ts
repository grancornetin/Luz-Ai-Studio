import { ReferenceSlot, PromptDNA } from '../types/promptTypes'
import { tokenParser } from './tokenParser'

export const promptBuilder = {

  buildPrompt(
    prompt: string,
    slots: ReferenceSlot[],
    dna: PromptDNA
  ): string {

    let resolvedPrompt = tokenParser.resolvePrompt(
      prompt,
      slots
    )

    const layers: string[] = []

    const activeSlots = slots.filter(s => s.imageUrl)

    const lockedSlots = activeSlots.filter(s => s.locked)
    const highPrioritySlots = activeSlots.filter(s => s.priority === 'high')

    // 🔒 HARD IDENTITY LOCK
    lockedSlots.forEach((slot, index) => {
      layers.push(
        `use the EXACT SAME person as in reference image ${index + 1}`
      )
      layers.push(
        `preserve identical face, identity, facial structure, and features`
      )
    })

    // 🔥 PRIORITY BOOST
    highPrioritySlots.forEach((slot, index) => {
      layers.push(
        `this subject is extremely important and must remain consistent with reference image ${index + 1}`
      )
    })

    // 👥 MULTI PERSON CONTROL
    const personSlots = activeSlots.filter(s => s.type === 'person')

    if (personSlots.length >= 2) {
      layers.push("group photo with clearly distinct individuals")
      layers.push("each person must match their respective reference image")
      layers.push("no face mixing, no identity blending")
    }

    // 🧬 DNA LAYERS
    if (dna.styles?.length) {
      layers.push("apply consistent visual style from references")
    }

    if (dna.products?.length) {
      layers.push("product must match reference exactly")
    }

    // 🧠 CONSISTENCIA ENTRE GENERACIONES
    layers.push(
      "same people, same identity, same faces across all generations"
    )

    layers.push(
      "do not change identity between generations"
    )

    const finalPrompt = [
      resolvedPrompt,
      ...layers
    ]
      .filter(Boolean)
      .join(", ")

    return finalPrompt
  },

  // 🆕 NEGATIVE PROMPT CENTRALIZADO
  buildNegativePrompt(): string {
    return [
      "blurry",
      "low quality",
      "deformed face",
      "extra limbs",
      "mutated hands",
      "bad anatomy",
      "face distortion",
      "identity mixing",
      "duplicate face",
      "cropped head",
      "out of frame",
      "unrealistic proportions"
    ].join(", ")
  }

}