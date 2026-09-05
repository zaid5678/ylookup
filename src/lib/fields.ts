// Canonical capital-account line items and the label variants different
// fund admins / LPs / custodians use for the same concept. This alias table
// is the core "reconciliation knowledge" — most cross-source mismatches in
// practice are label mismatches, not real breaks, so matching on meaning
// rather than exact text is what makes the tool useful.

export type FieldKey =
  | "beginningCapital"
  | "contributions"
  | "distributions"
  | "managementFees"
  | "partnershipExpenses"
  | "netInvestmentIncome"
  | "realizedGain"
  | "unrealizedGain"
  | "carriedInterest"
  | "endingCapital"
  | "commitment"
  | "unfundedCommitment";

export const FIELD_ORDER: FieldKey[] = [
  "beginningCapital",
  "contributions",
  "distributions",
  "managementFees",
  "partnershipExpenses",
  "netInvestmentIncome",
  "realizedGain",
  "unrealizedGain",
  "carriedInterest",
  "endingCapital",
  "commitment",
  "unfundedCommitment",
];

export const FIELD_LABELS: Record<FieldKey, string> = {
  beginningCapital: "Beginning capital account balance",
  contributions: "Contributions (capital called)",
  distributions: "Distributions",
  managementFees: "Management fees",
  partnershipExpenses: "Partnership / fund expenses",
  netInvestmentIncome: "Net investment income",
  realizedGain: "Realized gain / (loss)",
  unrealizedGain: "Unrealized gain / (loss)",
  carriedInterest: "Carried interest / incentive allocation",
  endingCapital: "Ending capital account balance",
  commitment: "Total commitment",
  unfundedCommitment: "Unfunded commitment",
};

// Order matters: more specific aliases first, since matching is first-match-wins
// per line and we don't want "capital" alone to swallow "capital contributions".
export const FIELD_ALIASES: Record<FieldKey, string[]> = {
  beginningCapital: [
    "beginning capital account balance",
    "opening capital account balance",
    "beginning capital balance",
    "beginning balance",
    "opening balance",
    "beginning capital",
  ],
  contributions: [
    "capital contributions",
    "contributions received",
    "capital called",
    "paid-in capital",
    "paid in capital",
    "contributions",
  ],
  distributions: [
    "capital distributions",
    "distributions paid",
    "return of capital",
    "distributions",
  ],
  managementFees: [
    "management fees",
    "management fee",
    "advisory fee",
    "advisory fees",
  ],
  partnershipExpenses: [
    "partnership expenses",
    "fund expenses",
    "organizational expenses",
    "operating expenses",
  ],
  netInvestmentIncome: [
    "net investment income",
    "interest income, net of expenses",
    "interest and dividend income",
  ],
  realizedGain: [
    "net realized gain/(loss)",
    "net realized gain (loss)",
    "realized gain/(loss)",
    "realized gains and losses",
    "realized gain",
  ],
  unrealizedGain: [
    "change in unrealized appreciation/(depreciation)",
    "unrealized appreciation/(depreciation)",
    "unrealized gain/(loss)",
    "unrealized gain",
  ],
  carriedInterest: [
    "carried interest",
    "incentive allocation",
    "performance allocation",
    "general partner carried interest",
  ],
  endingCapital: [
    "ending capital account balance",
    "closing capital account balance",
    "ending capital account value",
    "ending capital balance",
    "closing balance",
    "ending balance",
    "ending capital",
  ],
  commitment: [
    "total capital commitment",
    "capital commitment",
    "committed capital",
    "total commitment",
    "commitment",
  ],
  unfundedCommitment: [
    "unfunded capital commitment",
    "remaining commitment",
    "unfunded commitment",
  ],
};

// Fields where a mismatch that exactly equals another field's value on the
// same statement usually means "included elsewhere" rather than "wrong".
export const TIE_OUT_FORMULA: FieldKey[] = [
  "beginningCapital",
  "contributions",
  "distributions",
  "managementFees",
  "partnershipExpenses",
  "netInvestmentIncome",
  "realizedGain",
  "unrealizedGain",
  "carriedInterest",
];
