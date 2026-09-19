-- 2026-09-20 — products and knowledge documents are a TOTAL, not a monthly allowance.
-- Owner: "500 means you can add 500 products for the life time how long users use
-- the package". The code (plan-limits.js addsTotal) now counts every add the
-- account has made, with no monthly window; this changes only the card wording
-- stored in plans.feature_list (the admin-editable list the pricing page shows).
-- Numbers are untouched. Safe to run twice: the second run finds nothing to replace.
update plans
set feature_list = (
  select jsonb_agg(replace(replace(f, ' products added / month', ' products in total'),
                           ' knowledge documents added / month', ' knowledge documents in total')
                   order by ord)
  from jsonb_array_elements_text(feature_list) with ordinality as t(f, ord)
)
where feature_list::text like '%added / month%';
