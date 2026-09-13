const STEPS = [
  ['Add purchase details', 'Enter what you are considering, its estimated cost, and the date.'],
  ['Check your budget', 'RainCheck calculates that week, your checking cushion, and your savings plan.'],
  ['Review with AI', 'AI explains the calculated cash gap and tested ways to adjust the purchase.'],
  ['Save to your plan', 'Only a saved purchase is included in that month and can create an alert.'],
];

/** One honest map of the purchase flow, shared by the page and its planning drawer. */
export default function PurchaseSteps({ current = 0, compact = false }) {
  return <section className={`purchase-process${compact ? ' compact' : ''}`} aria-labelledby={compact ? undefined : 'purchase-process-title'} aria-label={compact ? 'Purchase planning steps' : undefined}>
    {!compact && <div className="purchase-process-heading">
      <span>Before anything changes</span>
      <h2 id="purchase-process-title">How purchase planning works</h2>
    </div>}
    <ol>
      {STEPS.map(([title, detail], index) => {
        const number = index + 1;
        const state = current === number ? ' current' : current > number ? ' complete' : '';
        return <li className={state} key={title} aria-current={current === number ? 'step' : undefined}>
          <span className="purchase-step-number" aria-hidden="true">{current > number ? '✓' : number}</span>
          <div><b>{title}</b><small>{detail}</small></div>
        </li>;
      })}
    </ol>
  </section>;
}
