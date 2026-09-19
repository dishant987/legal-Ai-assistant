import { describe, expect, it } from 'vitest';

import { statuteSchema, type Statute } from '../../types/statute.js';

import { bindingCaveat, CORPUS, depositMonths, matchStatutes, selectableFor } from './matcher.js';

describe('the corpus itself', () => {
  it('is valid against its schema', () => {
    for (const statute of CORPUS) expect(() => statuteSchema.parse(statute)).not.toThrow();
  });

  it('has no duplicate ids — ids are what the model selects by', () => {
    const ids = CORPUS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cites a source for every provision, so a claim can be checked', () => {
    for (const statute of CORPUS) {
      expect(statute.sourceUrl, `${statute.id} has no source`).toMatch(/^https:\/\//);
    }
  });

  it('quotes the provision rather than paraphrasing it', () => {
    // `text` is the statute's own words and `plain` is ours. If they were the
    // same, we would be presenting our summary as the law.
    for (const statute of CORPUS) expect(statute.text).not.toBe(statute.plain);
  });

  it('carries the clauses the product is built around', () => {
    const ids = CORPUS.map((s) => s.id);
    expect(ids).toContain('contract-act-1872-s27');
    expect(ids).toContain('model-tenancy-act-2021-s11');
  });

  it('cites no repealed code — BNS and BNSS replaced the IPC and CrPC', () => {
    for (const statute of CORPUS) {
      expect(statute.act).not.toMatch(/Indian Penal Code|Code of Criminal Procedure/i);
    }
  });
});

describe('depositMonths', () => {
  it.each([
    ['a security deposit of six (6) months of rent', 6],
    ['a security deposit equivalent to 6 months rent', 6],
    ["security deposit: two months' rent", 2],
    ['The security deposit shall be 3 (Three) months of rent', 3],
    ['SECURITY DEPOSIT of Twelve months', 12],
  ])('reads %s as %i', (text, expected) => {
    expect(depositMonths(text)).toBe(expected);
  });

  it('returns undefined when no deposit is stated', () => {
    expect(depositMonths('The Tenant shall pay rent monthly in advance.')).toBeUndefined();
  });

  it('returns undefined when a deposit is mentioned without a period', () => {
    expect(depositMonths('A security deposit is payable on signing.')).toBeUndefined();
  });

  it('ignores an unrelated month count elsewhere in the document', () => {
    // The window is deliberately narrow: a lock-in period is not a deposit.
    const text = 'The lock-in period shall be eleven months. Rent is payable monthly.';
    expect(depositMonths(text)).toBeUndefined();
  });

  it('ignores a word that is not a number', () => {
    expect(depositMonths('security deposit of several months rent')).toBeUndefined();
  });
});

describe('bindingCaveat — jurisdiction honesty (F11)', () => {
  const find = (id: string): Statute => {
    const statute = CORPUS.find((s) => s.id === id);
    if (!statute) throw new Error(`missing ${id}`);
    return statute;
  };

  it('states a central Act plainly, with no hedging', () => {
    expect(bindingCaveat(find('contract-act-1872-s27'), 'Karnataka')).toBeUndefined();
  });

  it('caveats a model Act we cannot confirm the state adopted', () => {
    // This is the failure that makes legal tooling actively misleading: a model
    // Act binds nobody until a state enacts its own version.
    const caveat = bindingCaveat(find('model-tenancy-act-2021-s11'), 'Karnataka');
    expect(caveat).toContain('model law');
    expect(caveat).toContain('Karnataka');
    expect(caveat).toContain('Rent Control Act');
  });

  it('still caveats when the reader did not tell us their state', () => {
    expect(bindingCaveat(find('model-tenancy-act-2021-s11'))).toContain('your state');
  });

  it('drops the caveat for a state known to have adopted it', () => {
    const adopted: Statute = {
      ...find('model-tenancy-act-2021-s11'),
      binding: { scope: 'model-act', adoptedBy: ['Assam'] },
    };
    expect(bindingCaveat(adopted, 'assam')).toBeUndefined();
    expect(bindingCaveat(adopted, 'Kerala')).toBeDefined();
  });

  it('handles a state-specific Act both ways', () => {
    const stateAct: Statute = {
      ...find('model-tenancy-act-2021-s11'),
      binding: { scope: 'state', states: ['Maharashtra'] },
    };
    expect(bindingCaveat(stateAct, 'Maharashtra')).toBeUndefined();
    expect(bindingCaveat(stateAct, 'Punjab')).toContain('Maharashtra');
    expect(bindingCaveat(stateAct)).toContain('Maharashtra');
  });
});

describe('matchStatutes — deterministic rules', () => {
  const RENT = 'The Tenant shall pay a security deposit equivalent to six (6) months of rent.';

  it('flags a deposit above the cap from the document’s own figure', () => {
    const [hit] = matchStatutes({ docType: 'rent-agreement', text: RENT, state: 'Karnataka' });

    expect(hit?.statuteId).toBe('model-tenancy-act-2021-s11');
    expect(hit?.because).toContain('6 months');
    expect(hit?.effect).toBe('capped');
  });

  it('carries the caveat with the hit rather than asserting the cap', () => {
    const [hit] = matchStatutes({ docType: 'rent-agreement', text: RENT, state: 'Karnataka' });
    expect(hit?.caveat).toContain('model law');
  });

  it('says nothing when the deposit is within the cap', () => {
    const text = "The Tenant shall pay a security deposit of two months' rent.";
    expect(matchStatutes({ docType: 'rent-agreement', text })).toEqual([]);
  });

  it('says nothing when no deposit is stated', () => {
    expect(matchStatutes({ docType: 'rent-agreement', text: 'Rent is payable monthly.' })).toEqual([]);
  });

  it('does not apply the tenancy rule to an employment contract', () => {
    expect(matchStatutes({ docType: 'employment-offer', text: RENT })).toEqual([]);
  });
});

describe('matchStatutes — what the model may propose (F12)', () => {
  const OFFER = 'The Employee shall not join any competing business for two years after leaving.';

  it('admits a real provision that fits the document', () => {
    const hits = matchStatutes({
      docType: 'employment-offer',
      text: OFFER,
      proposedIds: ['contract-act-1872-s27'],
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.effect).toBe('void');
    // The statute's own words, not the model's rendering of them.
    expect(hits[0]?.text).toContain('restrained from exercising a lawful profession');
  });

  it('drops an id that is not in the corpus', () => {
    // The model naming a section we do not ship is exactly how a fabricated
    // citation would reach a reader. It cannot.
    const hits = matchStatutes({
      docType: 'employment-offer',
      text: OFFER,
      proposedIds: ['indian-penal-code-s420', 'contract-act-1872-s999', ''],
    });
    expect(hits).toEqual([]);
  });

  it('drops a real provision that does not apply to this kind of document', () => {
    const hits = matchStatutes({
      docType: 'employment-offer',
      text: OFFER,
      proposedIds: ['model-tenancy-act-2021-s11'],
    });
    expect(hits).toEqual([]);
  });

  it('never duplicates a provision reached by both routes', () => {
    const hits = matchStatutes({
      docType: 'rent-agreement',
      text: 'security deposit of six (6) months of rent',
      proposedIds: ['model-tenancy-act-2021-s11', 'model-tenancy-act-2021-s11'],
    });
    expect(hits).toHaveLength(1);
  });

  it('keeps the deterministic reason when both routes find the same provision', () => {
    const hits = matchStatutes({
      docType: 'rent-agreement',
      text: 'security deposit of six (6) months of rent',
      proposedIds: ['model-tenancy-act-2021-s11'],
    });
    expect(hits[0]?.because).toContain('6 months');
  });

  it('handles no proposals at all', () => {
    expect(matchStatutes({ docType: 'nda', text: 'Confidential information.' })).toEqual([]);
  });
});

describe('selectableFor', () => {
  it('offers only provisions relevant to the document kind', () => {
    const ids = selectableFor('rent-agreement').map((s) => s.id);
    expect(ids).toContain('model-tenancy-act-2021-s11');
    expect(ids).not.toContain('gratuity-act-1972-s4');
  });

  it('gives the model a trigger to match against, not the statute text', () => {
    // The model chooses by id. Sending the full provision text would invite it
    // to quote law at the reader in its own words.
    for (const option of selectableFor('employment-offer')) {
      expect(option.trigger.length).toBeGreaterThan(10);
      expect(Object.keys(option)).toEqual(['id', 'trigger']);
    }
  });

  it('returns an empty list for a document kind nothing covers', () => {
    expect(selectableFor('birthday-card')).toEqual([]);
  });
});
