# PropWatch Decision Intelligence MVP

## Status

- **Purpose:** Technical product proposal for implementation handoff
- **Stage:** MVP
- **Approach:** Deterministic recommendation engine; no LLM or chat dependency

## Product Thesis

PropWatch should evolve from a portfolio dashboard that reports conditions into a decision product that identifies and prioritises useful actions.

The primary experience should answer:

> What is the most valuable action I can investigate next, why is it relevant, and what could it change?

The MVP should remain transparent and deterministic. Financial calculations, action eligibility, impact estimates, ranking, and explanations should be reproducible from portfolio data and explicit assumptions.

## Target User

Initially optimise for Australian, self-directed investors who:

- Own two to five residential investment properties
- Have meaningful mortgage exposure
- Are considering refinancing, improving cashflow, reducing risk, or purchasing again
- Currently coordinate decisions through spreadsheets, lender conversations, and disconnected records

## MVP Goals

1. Produce one clearly prioritised next action for a portfolio.
2. Quantify the potential portfolio impact of that action.
3. Explain the evidence, assumptions, confidence, and missing information.
4. Offer up to two credible alternatives.
5. Allow the investor to investigate, defer, dismiss, or complete an action.
6. Create a recurring feedback loop through recommendation changes and outcome tracking.

## Non-Goals

- General-purpose property investment advice
- Autonomous financial decisions or transactions
- LLM-generated recommendations or explanations
- A conversational or chat-first interface
- Precise lender serviceability assessment
- Tax, legal, lending, valuation, or financial advice
- Automated broker, lender, insurer, or property-manager workflows

## Existing Foundation

The current engine already provides useful deterministic building blocks:

- Portfolio and property snapshots
- Cashflow, equity, LVR, yield, and capital growth
- Sensitivity and debt projection
- Acquisition equity estimates
- Scenario modelling
- Threshold-based insights
- Portfolio decision dimensions

The main architectural change is to separate condition detection from recommendation generation and customer-facing copy.

## Proposed Architecture

```text
Portfolio facts
  -> deterministic calculations
  -> condition detection
  -> candidate action generation
  -> counterfactual evaluation
  -> goal-aware scoring
  -> ranked recommendations
  -> template-based presentation
  -> recommendation outcome tracking
```

### Design Principle

> Rules detect. Strategies propose. Simulations verify. Goals prioritise. Templates explain.

## Domain Model

### Investor Goal

The MVP should support one primary goal per portfolio.

```ts
type InvestorGoal = {
  type:
    | 'improve_cashflow'
    | 'prepare_next_purchase'
    | 'reduce_debt'
    | 'reduce_risk'
  targetValue?: number
  targetDate?: string
  maxMonthlyDeficit?: number
  minimumCashBuffer?: number
  riskTolerance: 'conservative' | 'balanced' | 'growth'
}
```

### Detected Condition

A condition describes an observed state without prescribing an action.

```ts
type DetectedCondition = {
  code: string
  scope: 'portfolio' | 'property'
  propertyId?: string
  severity: 'info' | 'warning' | 'critical'
  evidence: Record<string, number | string | boolean | null>
  detectedAt: string
  dataAsOf: string
}
```

Examples include `negative_cashflow`, `rate_above_reference`, `low_yield`, `high_lvr`, `renewal_approaching`, and `missing_required_data`.

### Candidate Action

```ts
type CandidateAction = {
  id: string
  type:
    | 'review_refinance'
    | 'review_rent'
    | 'pay_down_debt'
    | 'review_insurance'
  scope: 'portfolio' | 'property'
  propertyId?: string
  reasonCodes: string[]
  evidence: Record<string, number | string | boolean | null>
  assumptions: Record<string, number | string | boolean | null>
  requiredInputs: string[]
}
```

### Evaluated Action

```ts
type EvaluatedAction = CandidateAction & {
  baseline: PortfolioOutcome
  projected: PortfolioOutcome
  impact: {
    monthlyCashflowDelta?: number
    annualCashflowDelta?: number
    totalEquityDelta?: number
    weightedLvrDelta?: number
    totalInterestDelta?: number
    estimatedOneOffCost?: number
    estimatedBreakEvenMonths?: number
  }
  confidence: 'low' | 'medium' | 'high'
  confidenceReasons: string[]
  risks: string[]
  scoreComponents: ActionScoreComponents
  score: number
}
```

### Recommendation State

```ts
type RecommendationStatus =
  | 'new'
  | 'viewed'
  | 'investigating'
  | 'deferred'
  | 'dismissed'
  | 'completed'
```

Persist the recommendation, its inputs, assumptions, calculated impact, ranking, status, and timestamps. Historical recommendations must not change when calculation logic changes.

## MVP Action Strategies

Implement three strategies first. They should share a common evaluator interface.

### 1. Review Refinance

**Eligibility signals**

- Recorded rate exceeds a configurable reference rate by a meaningful margin
- Loan balance is sufficient for savings to be material
- Fixed-rate restrictions do not make the action obviously inappropriate

**Inputs and assumptions**

- Current balance, rate, repayment type, and remaining term
- Configurable target/reference rate
- Estimated discharge, application, valuation, and switching costs

**Outputs**

- Estimated repayment and cashflow change
- Annual saving
- Estimated switching cost and break-even period
- Portfolio cashflow and risk impact

### 2. Review Rent

**Eligibility signals**

- Gross yield or cashflow is below the configured portfolio target
- Rent data is present and sufficiently recent
- A rent review is not recorded as recently completed

**Inputs and assumptions**

- Current rent
- User-entered or externally supplied comparable rent
- Vacancy and management-cost assumptions

**Outputs**

- Monthly and annual cashflow improvement
- Yield change
- Sensitivity to vacancy or partial rent uplift

If comparable rent is unavailable, the action should request that input rather than invent a market rent.

### 3. Pay Down Debt

**Eligibility signals**

- The user has declared available funds
- LVR, cashflow, or interest exposure conflicts with the primary goal

**Inputs and assumptions**

- Available lump sum
- Loan rate and repayment type
- Whether funds would otherwise remain in an offset account

**Outputs**

- Interest saved
- Repayment or term impact
- Portfolio LVR and risk impact
- Opportunity-cost warning where appropriate

## Evaluation Interface

```ts
type ActionStrategy = {
  type: CandidateAction['type']
  detect(context: DecisionContext): CandidateAction[]
  evaluate(
    candidate: CandidateAction,
    context: DecisionContext
  ): EvaluatedAction
}
```

Strategies must not generate customer-facing prose. They return reason codes, evidence, assumptions, impacts, and confidence data.

## Ranking Model

Use a transparent weighted score rather than machine learning.

```ts
type ActionScoreComponents = {
  goalAlignment: number
  financialImpact: number
  urgency: number
  confidence: number
  riskReduction: number
  implementationFriction: number
  estimatedCost: number
}
```

Suggested initial model:

```text
score =
  goalAlignment * 0.30
  + financialImpact * 0.25
  + urgency * 0.15
  + confidence * 0.15
  + riskReduction * 0.10
  - implementationFriction * 0.03
  - estimatedCost * 0.02
```

All components should be normalised to a common range. Weights should be configuration, not embedded throughout strategy code.

Ranking rules:

- Do not recommend actions with unresolved blocking inputs.
- Low-confidence actions may be shown as investigation opportunities but should not rank first unless urgency is critical.
- Avoid recommending multiple actions that represent the same underlying decision.
- Prefer reversible investigation steps when two actions have similar scores.
- Re-rank when portfolio data, goals, assumptions, or recommendation status changes.

## Confidence Model

Confidence should reflect the quality of the recommendation, not the severity of the condition.

Reduce confidence when:

- Valuation, rent, debt, or rate data is old
- Required loan terms or costs are missing
- The evaluation depends on a generic benchmark
- The projected impact is highly sensitive to one assumption
- The action requires serviceability, tax, or market information not available to PropWatch

Every recommendation must expose:

- Data date
- Assumptions
- Missing inputs
- Confidence level and reasons

## Template-Based Explanations

Customer-facing copy should be rendered from structured data and reason codes.

```ts
type RecommendationTemplate = {
  title(action: EvaluatedAction): string
  summary(action: EvaluatedAction): string
  why(action: EvaluatedAction): string[]
  caveats(action: EvaluatedAction): string[]
}
```

Example output:

```text
Review refinancing St Mary Town House

The recorded rate is 7.60%. Modelling a rate of 6.50% improves estimated
portfolio cashflow by $420 per month before switching costs.

Why this is prioritised
- It has the highest estimated cashflow impact of the available actions.
- It directly supports your goal of reducing the monthly portfolio deficit.

Confidence: Medium
- Current loan balance and rate are recorded.
- Remaining term and switching costs require confirmation.
```

Templates must format only calculated or explicitly entered values. They must not introduce new financial claims.

## Product Surface

### Portfolio Home

Replace the current concern-first section with:

1. **Next best action** — highest-ranked eligible action
2. **Expected impact** — before-and-after portfolio metrics
3. **Why this action** — evidence and goal alignment
4. **Confidence and assumptions**
5. **Actions** — investigate, model, defer, dismiss
6. **Alternatives** — up to two lower-ranked actions

Existing health metrics and decision dimensions remain supporting evidence rather than the primary product output.

### Action Detail

The action detail should provide:

- Baseline versus projected metrics
- Editable assumptions
- Calculation caveats
- Sensitivity range where useful
- Required information checklist
- Status controls
- Completion outcome capture

### Plan

Keep the general scenario builder, but allow each recommendation to launch a preconfigured scenario. A user should not need to translate a recommendation into percentage inputs manually.

## Recurring Feedback Loop

The product should generate a new decision brief when:

- Portfolio data changes
- A material date threshold is crossed
- A saved assumption or reference value changes
- The primary goal changes
- An action is completed, dismissed, or deferred
- A completed action has an outcome available for comparison

The brief should answer:

- What changed?
- Did the next best action change?
- Is the portfolio closer to its goal?
- Which deferred action should be reviewed again?

## Persistence and Auditability

Recommended persisted entities:

- `investor_goals`
- `detected_conditions`
- `recommendations`
- `recommendation_events`
- `recommendation_outcomes`
- `decision_engine_runs`

Each engine run should record:

- Engine version
- Portfolio snapshot identifier
- Goal identifier
- Reference values used
- Generated candidates
- Evaluation assumptions
- Score components and final ranking

## Analytics

Track product usefulness rather than dashboard engagement alone:

- Recommendation viewed
- Assumptions opened or changed
- Action marked investigating
- Action deferred and defer reason
- Action dismissed and dismissal reason
- Action completed
- Estimated versus actual outcome
- Time from recommendation to decision
- Percentage of portfolios with at least one actionable, medium-confidence recommendation

Primary MVP success metric:

> Percentage of active portfolios where the user investigates or completes a recommendation within 30 days.

## Implementation Sequence

### Milestone 1: Engine Separation

- Extract condition detection from `generateInsights`
- Introduce goal, condition, candidate, evaluation, and score types
- Preserve current insights as a compatibility presentation layer

### Milestone 2: Action Evaluation

- Implement refinance, rent-review, and debt-paydown strategies
- Extend scenarios to support property-specific action assumptions
- Add confidence and missing-input evaluation

### Milestone 3: Ranking and Persistence

- Implement configurable goal-aware scoring
- Persist engine runs and recommendation state
- Add deterministic recommendation templates

### Milestone 4: Product Surface

- Add next-best-action card to Portfolio Home
- Add action detail and assumption editing
- Connect recommendations to preconfigured Plan scenarios
- Add investigate, defer, dismiss, and complete states

### Milestone 5: Feedback Loop

- Add change detection between engine runs
- Add recommendation outcome capture
- Add monthly decision brief generation
- Instrument usefulness analytics

## Acceptance Criteria

The MVP is complete when:

1. The same portfolio, goal, configuration, and engine version always produce the same ranked recommendations.
2. Every displayed number is traceable to a calculation, entered value, or configured reference value.
3. The engine can explain ranking through persisted score components.
4. Missing information lowers confidence or blocks recommendation rather than being invented.
5. At least three action types can be evaluated against the same baseline portfolio.
6. The Portfolio Home shows one primary recommendation and no more than two alternatives.
7. Users can investigate, defer, dismiss, and complete recommendations.
8. Completed recommendations can record actual outcomes.
9. Existing portfolio calculations and scenario tests continue to pass.

## Risks and Guardrails

- Label estimates clearly and show assumptions.
- Do not call equity-supported purchase price “borrowing capacity” without serviceability analysis.
- Do not claim a market rate or market rent unless its source and date are available.
- Do not recommend selling in the MVP; sell-versus-hold requires transaction costs, tax context, replacement strategy, and stronger suitability controls.
- Do not hide uncertainty behind a single score.
- Do not allow customer-facing templates to perform financial calculations.

## Deferred Opportunities

After the deterministic MVP demonstrates useful recommendations:

- Verified market-rate and rent-reference integrations
- Serviceability-aware acquisition modelling
- Broker, accountant, and adviser exports
- Read-only conversational explanations
- Bounded agent workflows that call deterministic evaluators
- Learning-to-rank using recommendation outcomes and dismissal reasons

LLM or agentic functionality should remain optional. The recommendation engine must continue to produce complete, useful, and auditable outputs without it.
