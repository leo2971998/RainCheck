/** Calculator verdicts have priority over generated explanations everywhere. */
export function budgetStatus(goal, cushion) {
  if (goal.low < 0) return { tone: 'bad', label: 'Checking would go below zero' };
  if (!goal.fits) return { tone: 'warn', label: 'Planned saving needs an adjustment' };
  if (goal.gap > 0) return { tone: 'warn', label: 'This plan falls short of the goal' };
  if (goal.low < cushion) return { tone: 'warn', label: 'Checking dips below your cushion' };
  return { tone: 'good', label: 'This fits the current estimates' };
}
