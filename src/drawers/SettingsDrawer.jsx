import { useState } from 'react';
import Drawer, { DrawerHeader } from '../components/Drawer.jsx';
import './SettingsDrawer.css';

export default function SettingsDrawer({ demoCost, onToggleRain, hasDecisions, onReset, onClose }) {
  const [confirmReset, setConfirmReset] = useState(false);
  return <Drawer label="Settings" onClose={onClose}>
    <DrawerHeader title="Settings" icon="gear" onClose={onClose} />
    <section className="settings-section">
      <h3>Demo scenarios</h3>
      <p className="fine">Try a scenario in this browser without changing bank records.</p>
      <div className="settings-scenario"><div><b>Rainy week</b><p>{demoCost ? 'Rain scenario is active.' : 'Add a sample cost to put this week over budget.'}</p></div>
        <button className="btn ghost sm" onClick={onToggleRain}>{demoCost ? 'Clear rain demo' : 'Start rain demo'}</button></div>
    </section>
    <section className="settings-section"><h3>Reset demo choices</h3><p className="fine">Clear budgets and choices saved in this browser.</p>
      {!confirmReset ? <button className="btn ghost" disabled={!hasDecisions} onClick={() => setConfirmReset(true)}>Reset choices</button>
        : <div role="alert"><p>Clear your saved choices?</p><div className="row wrap"><button className="btn" onClick={onReset}>Clear choices</button><button className="btn ghost" onClick={() => setConfirmReset(false)}>Cancel</button></div></div>}
    </section>
  </Drawer>;
}
