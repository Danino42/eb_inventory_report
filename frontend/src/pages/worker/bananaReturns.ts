import type { Variant } from '../../types/fruit'

/** Bananas sent back at the end of the day, in kg (typed text, like the fruit amounts).
    Asked every day: bananas don't stay in the storage until the next day */
export type BananaReturns = Record<Variant, string>

export const EMPTY_BANANA_RETURNS: BananaReturns = { conventional: '', bio: '' }
