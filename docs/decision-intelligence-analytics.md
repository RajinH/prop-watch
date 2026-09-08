# Decision intelligence — usefulness analytics

The MVP has no analytics vendor. The `recommendation_events` table **is** the
analytics store: every product-meaningful interaction writes a row, and the
usefulness metrics from `decision-intelligence-mvp.md` are SQL over it.

## Event coverage

| Spec metric | Event source |
|---|---|
| Recommendation viewed | `event_type = 'viewed'` |
| Assumptions opened / changed | `'assumptions_opened'` / `'assumptions_changed'` |
| Action marked investigating | `'status_changed'` with `to_status = 'investigating'` |
| Action deferred + reason | `'status_changed'` with `to_status = 'deferred'`, `reason` |
| Action dismissed + reason | `'status_changed'` with `to_status = 'dismissed'`, `reason` |
| Action completed | `'status_changed'` with `to_status = 'completed'` |
| Estimated vs actual outcome | `'outcome_recorded'` + `recommendation_outcomes` (estimated jsonb vs actual_* columns) |
| Recommendation re-ranked | `'re_evaluated'` (payload has previous_score/score) |
| Eligibility lost | `'expired'` |

## Primary MVP success metric

> Percentage of active portfolios where the user investigates or completes a
> recommendation within 30 days of it being created.

```sql
with first_created as (
  select recommendation_id, portfolio_id, min(created_at) as created_at
  from recommendation_events
  where event_type = 'created'
  group by recommendation_id, portfolio_id
),
acted as (
  select distinct e.portfolio_id
  from recommendation_events e
  join first_created fc on fc.recommendation_id = e.recommendation_id
  where e.event_type = 'status_changed'
    and e.to_status in ('investigating', 'completed')
    and e.created_at <= fc.created_at + interval '30 days'
)
select
  count(distinct fc.portfolio_id) as portfolios_with_recommendations,
  count(distinct a.portfolio_id) as portfolios_acted,
  round(100.0 * count(distinct a.portfolio_id)
        / nullif(count(distinct fc.portfolio_id), 0), 1) as pct_acted_within_30d
from first_created fc
left join acted a on a.portfolio_id = fc.portfolio_id;
```

## Supporting queries

Time from recommendation to decision:

```sql
select
  e.recommendation_id,
  e.to_status,
  e.created_at - fc.created_at as time_to_decision
from recommendation_events e
join (
  select recommendation_id, min(created_at) as created_at
  from recommendation_events where event_type = 'created'
  group by recommendation_id
) fc using (recommendation_id)
where e.event_type = 'status_changed'
  and e.to_status in ('investigating', 'deferred', 'dismissed', 'completed');
```

Portfolios with at least one actionable medium-confidence recommendation:

```sql
select round(
  100.0 * count(distinct portfolio_id) filter (
    where status in ('new', 'viewed', 'investigating')
      and confidence in ('medium', 'high')
      and jsonb_array_length(payload -> 'required_inputs') = 0
  ) / nullif(count(distinct portfolio_id), 0), 1
) as pct_with_actionable_recommendation
from recommendations;
```

Dismissal reasons (feed for future strategy tuning):

```sql
select reason, count(*)
from recommendation_events
where event_type = 'status_changed' and to_status = 'dismissed'
group by reason
order by count(*) desc;
```

Estimated vs actual accuracy for completed refinances/rent reviews:

```sql
select
  r.action_type,
  (o.estimated ->> 'monthly_cashflow_delta')::numeric as estimated_monthly,
  o.actual_monthly_delta,
  o.actual_monthly_delta - (o.estimated ->> 'monthly_cashflow_delta')::numeric as error
from recommendation_outcomes o
join recommendations r on r.id = o.recommendation_id
where o.actual_monthly_delta is not null;
```
