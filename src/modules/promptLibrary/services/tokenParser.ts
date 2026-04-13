import { ReferenceSlot } from '../types/promptTypes'

const TOKEN_REGEX = /@([a-zA-Z]+\s?\d*)/g

/**
 * Normaliza tokens para que coincidan aunque tengan
 * espacios, guiones o diferencias de formato.
 *
 * Ejemplos:
 * person1  -> person1
 * person 1 -> person1
 * person-1 -> person1
 * person_1 -> person1
 */
function normalizeToken(value: string): string {

  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '')

}

export const tokenParser = {

  /**
   * Extrae tokens del prompt
   */
  extractTokens(prompt: string): string[] {

    const matches = [...prompt.matchAll(TOKEN_REGEX)]

    if (!matches.length) return []

    return matches.map(m => m[1])

  },

  /**
   * Valida que los tokens tengan referencias cargadas
   */
  validateTokens(
    prompt: string,
    slots: ReferenceSlot[]
  ) {

    const tokens = this.extractTokens(prompt)

    const missing: string[] = []

    tokens.forEach(token => {

      const normalizedToken = normalizeToken(token)

      const slot = slots.find(s => {

        if (!s.role) return false

        const normalizedRole = normalizeToken(s.role)

        return normalizedRole === normalizedToken

      })

      if (!slot || !slot.imageUrl) {

        missing.push(token)

      }

    })

    return {

      valid: missing.length === 0,
      missing

    }

  },

  /**
   * Reemplaza tokens por etiquetas descriptivas
   */
  resolvePrompt(
    prompt: string,
    slots: ReferenceSlot[]
  ): string {

    let resolved = prompt

    slots.forEach(slot => {

      if (!slot.imageUrl) return
      if (!slot.role) return

      const role = slot.role

      const variants = [

        `@${role}`,
        `@${role.replace(/\d+$/, '')} ${role.match(/\d+$/)?.[0] || ''}`

      ]

      variants.forEach(token => {

        resolved = resolved.replaceAll(

          token,
          slot.label || role

        )

      })

    })

    return resolved

  }

}