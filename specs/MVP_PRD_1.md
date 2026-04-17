# PropWatch MVP — Decision Engine PRD

---

## 1. Overview

PropWatch is a **decision-support tool for property investors** designed to answer:

> **“Can I afford this property and is it a good decision?”**

This MVP is:

* NOT a dashboard
* NOT a property management system
* NOT dependent on external APIs

It is:

* a **single-decision engine**
* with **low input friction**
* delivering **instant, interpretable insights**

---

## 2. Technical Approach (MVP)

### 2.1 Stack

* **Framework:** Next.js (App Router)
* **Language:** TypeScript
* **Styling:** TailwindCSS
* **State Management:** React state (useState/useReducer)
* **Persistence:** localStorage (optional)

---

### 2.2 Architecture Principles

#### 1. No Backend (for MVP)

* No database
* No API layer
* No authentication
* No hosting concerns initially

All computation happens:

> **client-side only**

---

#### 2. Decision Engine Decoupling (CRITICAL)

The decision engine MUST be completely separate from UI.

Structure:

```id="arch_decision"
src/
  ├── engine/
  │     ├── decisionEngine.ts
  │     ├── types.ts
  │     ├── rules.ts
  │     └── scenarios.ts
  │
  ├── components/
  ├── app/
```

---

#### 3. Pure Function Design

Decision engine should be:

* deterministic
* stateless
* testable

Example:

```ts id="engine_fn"
function evaluateDecision(input: Input): DecisionResult
```

---

#### 4. UI = Renderer Only

UI responsibilities:

* collect inputs
* render outputs
* manage progressive disclosure

UI should NOT:

* contain business logic
* compute financial models

---

#### 5. Local Persistence (Optional)

Use localStorage to:

* persist last inputs
* restore session state

Example:

```ts id="local_storage"
localStorage.setItem("propwatch_state", JSON.stringify(state))
```

---

#### 6. Iteration-Friendly Design

The system must allow:

* adding/removing questions easily
* tweaking rules without UI changes
* modifying decision tree logic independently

---

## 3. Core Product Principles

### 3.1 Progressive Disclosure

* Show minimal inputs upfront
* Reveal additional inputs only when needed
* Avoid overwhelming users

---

### 3.2 Inline Reactive Experience

* Same page interaction
* No submit button
* Instant feedback loop

---

### 3.3 Structured Conversation (Non-Chat)

* Feels like a conversation
* Uses structured inputs
* Guided but editable

---

### 3.4 Context Compression

* Questions collapse into summaries
* Only active question expanded
* No accordion stacking

---

### 3.5 Separation of Concerns

Inputs ≠ Insights

* Inputs → stored context
* Insights → computed dynamically

---

## 4. Core User Goal

> Evaluate whether a property is a good financial decision.

---

## 5. Core User Flow

### Step 1 — Entry

```id="entry"
Can I afford this property?
```

---

### Step 2 — Minimal Inputs

* Property price
* Weekly rent

---

### Step 3 — Immediate Insight

```id="insight"
You lose ~$320/month
Risk: Medium
```

---

### Step 4 — Adaptive Questioning

System asks next question based on uncertainty.

---

## 6. Decision Tree (Dynamic)

### Node 1 — Base Inputs

* price
* rent

---

### Node 2 — Cashflow Evaluation

IF:

* cashflow < 0

ASK:

* deposit

---

### Node 3 — Affordability

IF:

* risk unclear OR deposit provided

ASK:

* income

---

### Node 4 — Portfolio Context

IF:

* still uncertain

ASK:

* propertyCount

---

### Node 5 — Optional Refinement

* interestRate (default)
* expensesRatio (default)

---

### Decision Flow

```id="flow"
START
  ↓
price + rent
  ↓
compute cashflow

IF negative:
  → ask deposit

IF affordability unclear:
  → ask income

IF portfolio unclear:
  → ask property count

ELSE:
  → stop
```

---

## 7. Data Model

### Inputs

#### Required

* price: number
* rentWeekly: number

#### Progressive

* deposit: number
* income: number
* propertyCount: enum
* interestRate: number
* expensesRatio: number

---

### Derived

* loanAmount
* monthlyRent
* monthlyRepayment
* expenses
* cashflow

---

## 8. Decision Engine

### 8.1 Compute Metrics

```ts id="calc"
cashflow = monthlyRent - repayment - expenses
```

---

### 8.2 Scenario Simulation

* interest +1%
* rent -10%

---

### 8.3 Risk Scoring

Factors:

* negative cashflow
* rate sensitivity
* rent dependency
* leverage

---

### 8.4 Insight Output

```id="output"
Primary:
- cashflow

Secondary:
- risk label

Supporting:
- reasoning bullets
```

---

## 9. UI / UX Specification

---

### 9.1 Layout

Single column:

```id="layout"
[ Context Summary ]
[ Active Question ]
[ Insight Card ]
```

---

### 9.2 Context Summary

```id="summary"
Price: $800k ✏️
Rent: $650 ✏️
```

---

### 9.3 Active Question

```id="question"
What’s your deposit?
[ 20% ]
```

---

### 9.4 Insight Card (Persistent)

```id="card"
You lose ~$320/month
Risk: Medium

- Sensitive to rate rises
```

---

### 9.5 Interaction Behaviour

* instant recompute
* smooth transitions (200–300ms)
* editable summaries

---

## 10. MVP Scope

### Must Have

* price + rent
* live insight
* adaptive questioning
* context compression

---

### Not Included

* backend
* DB
* integrations
* ML models
* dashboards

---

## 11. Future Extensions

* LLM conversational layer
* portfolio tracking
* saved scenarios

---

## 12. Success Criteria

* insight in <10 seconds
* zero onboarding friction
* clear decision guidance

---

## 13. Core Philosophy

> We are not collecting data.
> We are reducing decision uncertainty.

