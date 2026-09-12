export function detectPostedChanges(household, purchases, merchants) {
  const byName = Object.fromEntries(merchants.map(m => [m._id, m.name]));
  return household.recurring.map(r => {
    const posted = purchases.filter(p => byName[p.merchant_id]?.toLowerCase().includes(r.payee?.toLowerCase())).sort((a, b) => b.purchase_date.localeCompare(a.purchase_date))[0];
    if (!posted || Math.abs(posted.amount - r.amount) / r.amount <= 0.10) return r;
    return { ...r, lastPosted: posted.amount, unexplained: true };
  });
}

// Finds "renew at $90.00 starting with your October 1 bill" and "credit of $25.00 ended".
export function parseNotice(text, year = 2026) {
  const renew = /renew at \$([\d,.]+) starting with your ([A-Z][a-z]+) (\d{1,2}) bill/.exec(text);
  const credit = /promotional credit of \$([\d,.]+) ended/.exec(text);
  if (!renew) return null;
  const month = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(renew[2]) + 1;
<<<<<<< Updated upstream
=======
  // Contact details, taken from the notice itself rather than guessed. If the notice does not
  // name a support address, the app says so instead of sending the user somewhere invented.
  const support = /\b((?:support|help|billing)\.[a-z0-9.-]+\.[a-z]{2,})/i.exec(text)?.[1] || null;
  const account = /account ending (\w{3,4})/i.exec(text)?.[1] || null;
  const sender = (/From:\s*([^<\n]+)/.exec(text)?.[1] || '').trim() || null;

>>>>>>> Stashed changes
  return {
    to: Number(renew[1].replace(/,/g, '')),
    effective: `${year}-${String(month).padStart(2, '0')}-${String(renew[3]).padStart(2, '0')}`,
    why: credit ? 'Promotional credit ended' : 'Not stated in the notice',
<<<<<<< Updated upstream
    evidence: [renew[0], credit?.[0]].filter(Boolean),   // the exact phrases to highlight
    source: 'notice',
  };
}
=======
    credit: credit ? Number(credit[1].replace(/,/g, '')) : null,
    evidence: [renew[0], credit?.[0]].filter(Boolean),   // the exact phrases to highlight
    support, account, sender,
    source: 'notice',
  };
}

/**
 * Drafts a question the user can actually send. Every fact in it comes from the notice or the
 * user's own records, so nothing here is invented on their behalf.
 */
export function questionFor(bill, change) {
  const lines = [
    `Hello,`,
    ``,
    `My ${bill.label.toLowerCase()} is going from $${bill.amount} to $${change.to} a month, starting with my ${new Date(change.effective + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} bill.`,
    change.credit ? `Your notice says a $${change.credit} promotional credit ended.` : `Your notice does not say why.`,
    ``,
    `Could you tell me:`,
    `1. Is there a current promotion or plan I qualify for at my usage?`,
    `2. Is the $${change.to} rate fixed, or does it change again later?`,
    change.account ? `\nMy account ends ${change.account}.` : '',
    ``,
    `Thank you.`,
  ];
  return lines.filter(l => l !== undefined).join('\n');
}


/**
 * Which of the user's commitments does this notice describe?
 *
 * Matching is deliberately conservative: the sender line and the body are searched for the bill's
 * payee or its label. A weak guess is worse than no guess, because the user would be confirming a
 * change against the wrong commitment — so anything uncertain comes back as a ranked list for them
 * to choose from rather than a silent pick.
 */
export function matchBill(notice, recurring) {
  const from = (/From:\s*([^<\n]+)/.exec(notice)?.[1] || '').toLowerCase();
  const head = notice.slice(0, 400).toLowerCase();

  const scored = recurring.map(r => {
    const names = [r.payee, r.label].filter(Boolean).map(n => n.toLowerCase());
    let score = 0;
    for (const n of names) {
      if (from.includes(n)) score += 10;                       // the sender names it outright
      else if (head.includes(n)) score += 6;                   // the opening lines name it
      const words = n.split(/\s+/).filter(w => w.length > 3);
      score += words.filter(w => from.includes(w)).length * 4;
      score += words.filter(w => head.includes(w)).length * 2;
    }
    return { bill: r, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

  return {
    best: scored[0]?.score >= 6 ? scored[0].bill : null,       // confident enough to preselect
    ranked: scored.map(x => x.bill),
  };
}

/** Everything a user needs to check before accepting an imported change. */
export function reviewNotice(notice, recurring, year) {
  const change = parseNotice(notice, year);
  const { best, ranked } = matchBill(notice, recurring);
  return {
    change,
    suggested: best,
    candidates: ranked.length ? ranked : recurring,
    problems: [
      !change && 'No renewal amount and date were found. RainCheck reads one sentence pattern: "…will renew at $X starting with your Month D bill."',
      change && !best && 'The notice does not clearly name one of your commitments. Choose which bill it belongs to.',
    ].filter(Boolean),
  };
}
>>>>>>> Stashed changes
