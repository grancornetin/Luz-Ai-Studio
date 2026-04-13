import { ReferenceSlot } from '../types/promptTypes'
import { tokenParser } from './tokenParser'

export type ValidationResult = {

  valid: boolean
  errors: string[]

}

export const payloadValidator = {

  validateGeneration(

    prompt: string,
    slots: ReferenceSlot[]

  ): ValidationResult {

    const errors: string[] = []

    // 1. prompt vacío
    if (!prompt || prompt.trim().length === 0) {

      errors.push("Prompt cannot be empty")

    }

    // 2. detectar tokens
    const tokens = tokenParser.extractTokens(prompt)

    // 3. solo validar referencias si hay tokens
    if (tokens.length > 0) {

      const tokenCheck = tokenParser.validateTokens(
        prompt,
        slots
      )

      if (!tokenCheck.valid) {

        errors.push(
          "Missing references: " +
          tokenCheck.missing.join(", ")
        )

      }

    }

    return {

      valid: errors.length === 0,
      errors

    }

  }

}