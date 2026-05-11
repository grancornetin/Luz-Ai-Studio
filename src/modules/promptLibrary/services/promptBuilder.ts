import { ReferenceSlot, PromptDNA } from '../types/promptTypes'
import { referenceService } from './referenceService'
import { tokenParser } from './tokenParser'

const slotToken = (slot: ReferenceSlot): string => {
  return slot.role ? `@${slot.role}` : slot.label
}

const slotPersonIndex = (slot: ReferenceSlot): number | undefined => {
  if (slot.personIndex) return slot.personIndex
  const match = slot.role?.match(/\d+$/)
  return match ? Number(match[0]) : undefined
}

const priorityInstruction = (slot: ReferenceSlot, refNumber: number): string | null => {
  if (slot.priority !== 'high') return null

  switch (slot.type) {
    case 'person':
      return `High priority: the person in reference image ${refNumber} must strongly match their identity reference`
    case 'outfit':
      return `High priority: the clothing in reference image ${refNumber} must override any conflicting outfit details`
    case 'product':
      return `High priority: the product in reference image ${refNumber} must remain clearly visible and accurate`
    case 'scene':
      return `High priority: the environment should strongly follow reference image ${refNumber}`
    default:
      return `High priority: reference image ${refNumber} must strongly influence the result`
  }
}

const lockInstruction = (slot: ReferenceSlot, refNumber: number): string | null => {
  if (!slot.locked) return null

  switch (slot.type) {
    case 'person':
      return `Hard lock reference image ${refNumber}: preserve the exact face, identity, facial structure, and recognizable person`
    case 'outfit':
      return `Hard lock reference image ${refNumber}: preserve the exact garment design, colors, fabric, fit, logos, and accessories`
    case 'product':
      return `Hard lock reference image ${refNumber}: preserve the exact product shape, materials, proportions, color, branding, and details`
    case 'scene':
      return `Hard lock reference image ${refNumber}: preserve the location, lighting, spatial layout, surfaces, palette, and atmosphere`
    default:
      return `Hard lock reference image ${refNumber}: preserve the referenced subject accurately`
  }
}

const slotInstruction = (
  slot: ReferenceSlot,
  refNumber: number,
  personRefNumbers: Map<number, number>
): string[] => {
  const label = `${slot.label || slot.type} (${slotToken(slot)})`
  const instructions: string[] = []

  switch (slot.type) {
    case 'person':
      instructions.push(
        `Reference image ${refNumber} is ${label}: use it as a person identity reference; preserve face, facial structure, hair, body cues, skin tone, and recognizable identity`
      )
      break

    case 'outfit': {
      const assignedPersonRef = slot.personIndex ? personRefNumbers.get(slot.personIndex) : undefined
      const assignment = assignedPersonRef
        ? `Apply this outfit to the person from reference image ${assignedPersonRef}`
        : 'Use only the clothing information; do not copy the body, face, pose, or background from this outfit image'

      instructions.push(
        `Reference image ${refNumber} is ${label}: use it as an outfit reference; transfer clothing silhouette, fit, fabric, color, pattern, logos, styling, and accessories. ${assignment}`
      )
      break
    }

    case 'product':
      instructions.push(
        `Reference image ${refNumber} is ${label}: use it as a product/object reference; preserve shape, color, materials, branding, proportions, texture, and distinctive details`
      )
      break

    case 'scene':
      instructions.push(
        `Reference image ${refNumber} is ${label}: use it as an environment reference; borrow location, layout, lighting, palette, atmosphere, architecture, and surfaces without importing unrelated people or products`
      )
      break
  }

  const priority = priorityInstruction(slot, refNumber)
  if (priority) instructions.push(priority)

  const lock = lockInstruction(slot, refNumber)
  if (lock) instructions.push(lock)

  return instructions
}

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

    const activeSlots = referenceService.buildOrderedSlots(slots)
    const personRefNumbers = new Map<number, number>()

    activeSlots.forEach((slot, index) => {
      if (slot.type !== 'person') return
      const personIndex = slotPersonIndex(slot)
      if (personIndex) personRefNumbers.set(personIndex, index + 1)
    })

    activeSlots.forEach((slot, index) => {
      layers.push(...slotInstruction(slot, index + 1, personRefNumbers))
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
    if (personSlots.length > 0) {
      layers.push(
        "same people, same identity, same faces across all generations"
      )

      layers.push(
        "do not change identity between generations"
      )
    }

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
