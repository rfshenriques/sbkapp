import { describe, expect, it } from 'vitest';
import { formatCampaignRequirements, formatCampaignTrigger } from './formatCampaignRequirements';

describe('formatCampaignRequirements', () => {
  it('omits every condition that is unset', () => {
    expect(
      formatCampaignRequirements({ minStakeCents: null, minOddsPerLeg: null, betType: 'EITHER', minSelections: null }),
    ).toEqual([]);
  });

  it('formats a minimum stake in euros', () => {
    expect(
      formatCampaignRequirements({ minStakeCents: 1000, minOddsPerLeg: null, betType: 'EITHER', minSelections: null }),
    ).toEqual(['Min stake 10.00 €']);
  });

  it('formats a minimum odds per leg', () => {
    expect(
      formatCampaignRequirements({ minStakeCents: null, minOddsPerLeg: 1.5, betType: 'EITHER', minSelections: null }),
    ).toEqual(['Min odds 1.50 per leg']);
  });

  it('formats singles-only', () => {
    expect(
      formatCampaignRequirements({ minStakeCents: null, minOddsPerLeg: null, betType: 'SINGLES_ONLY', minSelections: null }),
    ).toEqual(['Singles only']);
  });

  it('formats accumulator-only with a minimum selections count', () => {
    expect(
      formatCampaignRequirements({ minStakeCents: null, minOddsPerLeg: null, betType: 'ACCUMULATOR_ONLY', minSelections: 3 }),
    ).toEqual(['Accumulator only, min 3 selections']);
  });

  it('formats a minimum-selections condition on an EITHER bet type as conditional on it being an accumulator', () => {
    expect(
      formatCampaignRequirements({ minStakeCents: null, minOddsPerLeg: null, betType: 'EITHER', minSelections: 2 }),
    ).toEqual(['Min 2 selections if accumulator']);
  });

  it('combines every set condition', () => {
    expect(
      formatCampaignRequirements({ minStakeCents: 500, minOddsPerLeg: 1.2, betType: 'SINGLES_ONLY', minSelections: null }),
    ).toEqual(['Min stake 5.00 €', 'Min odds 1.20 per leg', 'Singles only']);
  });
});

describe('formatCampaignTrigger', () => {
  it('describes a PLACEMENT trigger as immediate', () => {
    expect(
      formatCampaignTrigger({ trigger: 'PLACEMENT', triggerOnWon: false, triggerOnLost: false, triggerOnVoid: false }),
    ).toBe('Freebet credited as soon as you place a qualifying bet.');
  });

  it('describes a SETTLEMENT trigger by its configured outcomes', () => {
    expect(
      formatCampaignTrigger({ trigger: 'SETTLEMENT', triggerOnWon: false, triggerOnLost: true, triggerOnVoid: false }),
    ).toBe('Freebet credited once your qualifying bet loses.');
  });

  it('joins multiple configured outcomes', () => {
    expect(
      formatCampaignTrigger({ trigger: 'SETTLEMENT', triggerOnWon: true, triggerOnLost: true, triggerOnVoid: true }),
    ).toBe('Freebet credited once your qualifying bet wins or loses or is voided.');
  });
});
