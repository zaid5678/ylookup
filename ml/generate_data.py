"""Synthetic training data for the capital-account field extractor.

We don't have real fund documents yet (those come out of Saturday's
interviews), so this generates varied statement text that exercises the
thing an LLM should be better at than the regex/alias parser in
src/lib/parse.ts: recognizing the same 12 canonical fields under label
wording, ordering, currency formatting, and noise the fixed alias list
was never told about.

Output: JSONL conversations at ml/data/{train,val}.jsonl, in the
{"messages": [...]} shape tinker_cookbook.supervised.data.FromConversationFileBuilder
expects. Swap this file's output for real (statement text -> verified JSON)
pairs the moment real documents are available -- the training script does
not change.
"""

import json
import random
from pathlib import Path

random.seed(7)

FIELDS = [
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
]

# Several label phrasings per field, deliberately going beyond the alias
# list in src/lib/fields.ts (typos, abbreviations, different conventions)
# so the model has to generalize rather than memorize our own alias table.
LABEL_VARIANTS = {
    "beginningCapital": [
        "Beginning Capital Account Balance",
        "Opening Balance",
        "Beginning NAV",
        "BOP Capital Balance",
        "Capital Account - Beginning of Period",
        "Beg. Balance",
    ],
    "contributions": [
        "Capital Contributions",
        "Paid-in Capital",
        "Capital Called",
        "Contributions Received This Period",
        "LP Contributions",
    ],
    "distributions": [
        "Distributions",
        "Capital Distributions",
        "Distributions Paid",
        "Return of Capital",
        "Cash Distributed to LPs",
    ],
    "managementFees": [
        "Management Fees",
        "Management Fee",
        "Advisory Fee",
        "Mgmt Fee Expense",
        "Investment Management Fee",
    ],
    "partnershipExpenses": [
        "Partnership Expenses",
        "Fund Expenses",
        "Organizational Expenses",
        "Operating Expenses",
        "Other Fund Expenses",
    ],
    "netInvestmentIncome": [
        "Net Investment Income",
        "Interest and Dividend Income, Net",
        "Net Investment Income/(Loss)",
        "NII",
    ],
    "realizedGain": [
        "Net Realized Gain/(Loss)",
        "Realized Gain (Loss)",
        "Realized Gains and Losses",
        "Realized G/L",
    ],
    "unrealizedGain": [
        "Change in Unrealized Appreciation/(Depreciation)",
        "Unrealized Gain/(Loss)",
        "Unrealized Appreciation (Depreciation)",
        "Change in Unrealized G/L",
    ],
    "carriedInterest": [
        "Carried Interest",
        "Incentive Allocation",
        "Performance Allocation",
        "GP Carry",
    ],
    "endingCapital": [
        "Ending Capital Account Balance",
        "Closing Balance",
        "Ending NAV",
        "EOP Capital Balance",
        "Capital Account - End of Period",
    ],
    "commitment": [
        "Total Capital Commitment",
        "Committed Capital",
        "Total Commitment",
        "LP Commitment",
    ],
    "unfundedCommitment": [
        "Unfunded Commitment",
        "Remaining Commitment",
        "Undrawn Commitment",
    ],
}

INVESTOR_NAMES = [
    "Meridian Pension Trust", "Ashford State Retirement System",
    "Calder Family Office", "Brightline Endowment Fund",
    "Northwood University Endowment", "Talbot Sovereign Wealth Fund",
]
FUND_NAMES = [
    "Northbridge Capital Partners III, L.P.", "Aldergate Growth Fund IV, L.P.",
    "Solstice Buyout Fund II, L.P.", "Harrow Ventures V, L.P.",
]


def money(n: float, style: str) -> str:
    neg = n < 0
    a = abs(n)
    s = f"{a:,.2f}"
    if style == "paren":
        return f"(${s})" if neg else f"${s}"
    if style == "minus":
        return f"-${s}" if neg else f"${s}"
    if style == "plain_paren":
        return f"({s})" if neg else s
    return f"-{s}" if neg else s  # plain


def gen_statement():
    beginning = round(random.uniform(1_000_000, 20_000_000), 2)
    contributions = round(random.uniform(0, 2_000_000), 2)
    distributions = -round(random.uniform(0, 1_500_000), 2)
    mgmt_fees = -round(beginning * random.uniform(0.005, 0.02), 2)
    expenses = -round(random.uniform(1_000, 50_000), 2)
    nii = round(random.uniform(-20_000, 60_000), 2)
    realized = round(random.uniform(-200_000, 500_000), 2)
    unrealized = round(random.uniform(-400_000, 900_000), 2)
    carry = -round(max(0, realized + unrealized) * random.uniform(0, 0.2), 2)
    ending = round(
        beginning + contributions + distributions + mgmt_fees + expenses
        + nii + realized + unrealized + carry,
        2,
    )
    commitment = round(beginning * random.uniform(1.3, 2.5), 2)
    unfunded = round(commitment - beginning - contributions, 2)

    values = {
        "beginningCapital": beginning,
        "contributions": contributions,
        "distributions": distributions,
        "managementFees": mgmt_fees,
        "partnershipExpenses": expenses,
        "netInvestmentIncome": nii,
        "realizedGain": realized,
        "unrealizedGain": unrealized,
        "carriedInterest": carry,
        "endingCapital": ending,
        "commitment": commitment,
        "unfundedCommitment": unfunded,
    }
    return values


def render_statement(values: dict, investor: str, fund: str, date: str) -> str:
    style = random.choice(["paren", "minus", "plain_paren", "plain"])
    sep = random.choice([": ", ":\t", " - ", ": $"]) if style != "plain" else random.choice([": ", " - "])
    include = [f for f in FIELDS if random.random() > 0.08]  # occasionally drop a field
    order = include[:]
    random.shuffle(order)

    lines = [f"Investor: {investor}", f"Fund: {fund}", f"As of: {date}", ""]
    for key in order:
        label = random.choice(LABEL_VARIANTS[key])
        val = money(values[key], style)
        lines.append(f"{label}{sep}{val}")
    return "\n".join(lines)


def make_example():
    values = gen_statement()
    investor = random.choice(INVESTOR_NAMES)
    fund = random.choice(FUND_NAMES)
    year = random.choice([2024, 2025, 2026])
    quarter_end = random.choice(["March 31", "June 30", "September 30", "December 31"])
    date = f"{quarter_end}, {year}"

    text = render_statement(values, investor, fund, date)

    output = {"investorName": investor, "fundName": fund, "asOfDate": date}
    for k in FIELDS:
        output[k] = values[k]
    # Reflect fields the renderer actually dropped as null, since the whole
    # point is teaching the model to say "not reported" rather than guess.
    present_labels = set()
    for line in text.split("\n"):
        for key in FIELDS:
            if any(line.startswith(v) or f" {v}" in line for v in LABEL_VARIANTS[key]):
                present_labels.add(key)
    for k in FIELDS:
        if k not in present_labels:
            output[k] = None

    system = (
        "You extract structured data from LP capital account statements. "
        "Given the raw statement text, output a single JSON object with exactly "
        "these keys: investorName, fundName, asOfDate, " + ", ".join(FIELDS) + ". "
        "Use null for any field not present in the text. Numeric fields are plain "
        "numbers (negative for outflows/losses), not strings. Output JSON only."
    )
    return {
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": text},
            {"role": "assistant", "content": json.dumps(output, ensure_ascii=False)},
        ]
    }


def main():
    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(exist_ok=True)

    n_train, n_val = 2000, 200
    with open(out_dir / "train.jsonl", "w") as f:
        for _ in range(n_train):
            f.write(json.dumps(make_example()) + "\n")
    with open(out_dir / "val.jsonl", "w") as f:
        for _ in range(n_val):
            f.write(json.dumps(make_example()) + "\n")

    print(f"Wrote {n_train} train / {n_val} val examples to {out_dir}")


if __name__ == "__main__":
    main()
