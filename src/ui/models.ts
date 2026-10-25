import type { Model } from '../data/types'

export const MODEL_LABEL: Record<Model, string> = { DD: 'Double-deck', SD: 'Single-deck' }

/** Colour follows the model everywhere, never its rank. */
export const MODEL_COLOR: Record<Model, string> = { DD: 'var(--series-1)', SD: 'var(--series-2)' }
