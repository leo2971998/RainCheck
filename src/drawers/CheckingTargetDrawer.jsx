import { useState } from 'react';
import Drawer, { DrawerHeader, DrawerCloseButton } from '../components/Drawer.jsx';
import { budgetMoney as money } from '../components/BudgetImpact.jsx';
import { readCheckingTarget } from '../engine/plan.js';

export default function CheckingTargetDrawer({ h, sim, change, onClose }) {
  const [value, setValue] = useState(String(h.cushion));
  const [error, setError] = useState('');
  const save = e => {
    e.preventDefault();
    try {
      const cushion = readCheckingTarget(value);
      if (cushion !== h.cushion) change({ cushion }, `Checking target set to ${money(cushion)}`);
      onClose();
    } catch (e) { setError(e.message); }
  };
  return <Drawer label="Checking target" onClose={onClose} protectChanges>
    <DrawerHeader title="Keep money for surprises" icon="target" onClose={onClose} />
    <p>Choose how much you want to keep in checking for unexpected costs. This is separate from your savings goal.</p>
    <form className="budget-form" onSubmit={save}>
      <label>Keep in checking ($)
        <input type="number" inputMode="decimal" min="0" max="1000000" step="0.01" required
          value={value} onChange={e => { setValue(e.target.value); setError(''); }} aria-describedby="checking-target-help" />
      </label>
      <p className="fine" id="checking-target-help">Rain warns you when the plan goes under this amount. A storm means checking could go below $0.</p>
      <div className="alert">
        <p>Your forecast still drops to {money(sim.low.balance)}. Changing the target only changes warnings and how much the plan can put toward savings.</p>
        {value !== '' && Number(value) < h.cushion && <p>Lowering this target leaves a smaller safety buffer. It does not reduce your bills.</p>}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="row wrap">
        <button className="btn" type="submit">Save target</button>
        <DrawerCloseButton className="btn ghost">Cancel</DrawerCloseButton>
      </div>
    </form>
  </Drawer>;
}
