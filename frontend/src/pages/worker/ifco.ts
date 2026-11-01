/** Monday-only IFCO (reusable crate) check from the paper form */
export interface IfcoState {
  /** IFCOs received back from customers (typed text, like the fruit amounts) */
  returned: string
  /** At least 1 stack of large and 2 stacks of small clean IFCOs; null = not answered yet */
  enoughClean: boolean | null
  reorderSmall: boolean
  reorderLarge: boolean
}

export const EMPTY_IFCO: IfcoState = { returned: '', enoughClean: null, reorderSmall: false, reorderLarge: false }
