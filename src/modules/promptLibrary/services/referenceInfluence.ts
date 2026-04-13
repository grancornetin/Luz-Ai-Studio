import { ReferenceSlot, ReferencePriority } from '../types/promptTypes'

export type ReferenceInfluence = {

  id: string
  role?: string
  weight: number
  locked: boolean
  imageUrl: string

}

export const referenceInfluence = {

  /**
   * Convierte prioridad en peso
   */
  priorityToWeight(priority?: ReferencePriority): number {

    switch (priority) {

      case 'high':
        return 1

      case 'medium':
        return 0.6

      case 'low':
        return 0.3

      default:
        return 0.6

    }

  },

  /**
   * Construye lista de influencias
   */
  buildInfluences(
    slots: ReferenceSlot[]
  ): ReferenceInfluence[] {

    const influences: ReferenceInfluence[] = []

    slots.forEach(slot => {

      if (!slot.imageUrl) return

      influences.push({

        id: slot.id,

        role: slot.role,

        imageUrl: slot.imageUrl,

        locked: !!slot.locked,

        weight: this.priorityToWeight(slot.priority)

      })

    })

    return influences

  }

}