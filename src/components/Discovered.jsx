import { Icon, money, prettyIso } from './ui.jsx';

/**
 * Commitments the bank never listed as bills, proposed from the spending history.
 *
 * Everything here is a question, never an addition. A repeated purchase is not a subscription —
 * four rides in a month look identical to a monthly charge unless you check the amount and the
 * interval, and even then a bus fare can pass the test. So the evidence is shown and the user
 * decides.
 */
export default function Discovered({ found, onAdopt, onDismiss }) {
  if (!found.length) return null;
  return (
    <div className="card">
      <div className="hd">
        <h2>Possible commitments</h2>
        <span className="pill neutral">{found.length} to check</span>
      </div>
      <div className="fine">
        These charge steadily but are not in your bank's bill list, so the forecast does not count them.
        Add one only if it is really a commitment.
      </div>

      {found.map(f => (
        <div className="option" key={f.id}>
          <div className="row between">
            <h3>{f.label} · {money(f.amount)} {f.freq.toLowerCase()}</h3>
            <span className="pill neutral">Not counted yet</span>
          </div>
          <p>{f.why}</p>
          <div className="row wrap fine" style={{ gap: 8 }}>
            {f.evidence.map(e => <span className="pill neutral" key={e.date}>{prettyIso(e.date)} · {money(e.amount)}</span>)}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm" onClick={() => onAdopt(f)}><Icon n="check" s={13} />Add as a commitment</button>
            <button className="btn ghost sm" onClick={() => onDismiss(f)}>Not a commitment</button>
          </div>
        </div>
      ))}
    </div>
  );
}
