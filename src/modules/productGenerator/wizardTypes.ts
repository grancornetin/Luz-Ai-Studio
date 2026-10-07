// Tipos del wizard del módulo Producto.
// Alineados 1:1 con productDirectorService para evitar mapeos intermedios.

import type {
  ProductObjective,
  ProductStyle,
  ProductGenerationMode,
  ProductGridType,
} from './productDirectorService';

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

// Goal del wizard = ProductObjective del director.
export type Goal = ProductObjective;

// Estilo del wizard = ProductStyle del director.
export type StylePreset = ProductStyle;

// Modo del wizard = ProductGenerationMode del director ('pack' | 'grid' | 'recreate').
// El usuario solo elige entre 'pack' y 'grid' (UI). 'recreate' se activa
// automáticamente cuando hay imagen de referencia.
export type GenMode = Exclude<ProductGenerationMode, 'recreate'>;

// Grid sizes que ofrece el director.
export type GridSize = ProductGridType;

export type PackCount = 1 | 2 | 4 | 6;

export type RefCount = 1 | 2;

export interface WizardTypeState {
  mode: GenMode;
  packCount: PackCount;
  gridSize: GridSize;
  refCount: RefCount;
  computedCost: number;
  finalCount: number;
}

export interface WizardStyleState {
  referenceImg: string | null;
  preset: StylePreset | null;
}

export interface WizardProductState {
  title: string;
  desc: string;
  slots: (string | null)[];
}

export interface WizardState {
  product: WizardProductState;
  goal: Goal | null;
  style: WizardStyleState;
  type: WizardTypeState;
}

export interface WizardStepDef {
  id: WizardStep;
  label: string;
}

// Pantallas del flujo (el número vive en la URL como ?paso=N; el 6 lo usan
// también los avisos para abrir directo los resultados).
export const WIZARD_STEPS: WizardStepDef[] = [
  { id: 1, label: 'Inicio' },
  { id: 2, label: 'Tu producto' },
  { id: 3, label: 'Estilo' },
  { id: 4, label: 'Revisa y crea' },
  { id: 5, label: 'Creando' },
  { id: 6, label: 'Listas' },
];

export const INITIAL_WIZARD_STATE: WizardState = {
  product: { title: '', desc: '', slots: [null, null, null, null] },
  goal: 'social',
  style: { referenceImg: null, preset: null },
  type: {
    mode: 'pack',
    packCount: 4,
    gridSize: '2x2',
    refCount: 2,
    computedCost: 0,
    finalCount: 4,
  },
};
