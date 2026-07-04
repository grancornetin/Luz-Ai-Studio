// ── Module Preset System — tipos globales ──────────────────────────────────
// Cada módulo define su propio adapter. El sistema de storage/UI es compartido.

export type ModuleId =
  | 'photodump'
  | 'planner'
  | 'campaign'
  | 'contentStudioPro'
  | 'productGenerator'
  | 'outfitExtractor'
  | 'cloneMaster'
  | string; // extensible para módulos futuros

export interface PresetAsset {
  key: string;      // identificador semántico, e.g. "avatarRef", "outfitRef_0"
  url: string;      // URL pública de Firebase Storage
  mimeType?: string;
}

export interface ModulePreset<TConfig = Record<string, unknown>> {
  id: string;
  moduleId: ModuleId;
  name: string;
  description?: string;
  thumbnail?: string;       // URL de la primera imagen del preset (para preview)
  createdAt: number;        // epoch ms
  updatedAt: number;
  config: TConfig;          // payload serializado por el adapter del módulo
  assets: PresetAsset[];    // referencias a archivos subidos a Storage
  version: number;          // para futuras migraciones por módulo
}

// Lo que se necesita para crear/actualizar un preset (sin id ni timestamps)
export type ModulePresetInput<TConfig = Record<string, unknown>> = Omit<
  ModulePreset<TConfig>,
  'id' | 'createdAt' | 'updatedAt'
>;

// Archivo pendiente de subir (antes de tener URL de Storage)
export interface PresetAssetInput {
  key: string;
  file?: File;         // archivo local a subir
  existingUrl?: string; // URL ya existente que se puede reusar
  mimeType?: string;
}

// Contrato que cada módulo debe implementar
export interface ModulePresetAdapter<TState> {
  moduleId: ModuleId;
  version: number;

  // Convierte el estado del módulo en un objeto JSON guardable
  serialize(state: TState): Record<string, unknown>;

  // Restaura el estado desde el JSON guardado
  deserialize(config: Record<string, unknown>, assets: PresetAsset[]): Partial<TState>;

  // Retorna los archivos que deben subirse a Storage (opcional)
  getAssets?(state: TState): PresetAssetInput[];

  // Valida que un config guardado siga siendo compatible (opcional)
  validate?(config: Record<string, unknown>): boolean;

  // Genera un nombre automático si el usuario no escribe uno (opcional)
  defaultName?(state: TState): string;
}
