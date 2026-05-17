/**
 * System-managed defaults for run templates.
 *
 * Some scope fields shouldn't be exposed to end users — they require system
 * knowledge (what counts as a "hop", how budget windows refresh, etc.) and
 * surfacing them as form inputs creates user-visible failures (audit runs
 * throttle on the first batch when the budget is set too low).
 *
 * Centralized here so the same default flows through both the new-template
 * wizard and any future programmatic trigger paths. Tune this value via
 * deploy if a class of demos needs more headroom; per-template overrides
 * should require an explicit advanced/admin pathway, not a default form.
 */

/** Per-run hop budget for audit traversals.
 *  Sized for a typical bilateral audit at depth ≤ 3 with ~10 root products
 *  and an avg fan-out of 2 subcomponents per tier (≈ 30 + 60 + 120 hops). */
export const SYSTEM_AUDIT_HOP_BUDGET = 500;
