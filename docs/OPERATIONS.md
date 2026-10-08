# Apex operations runbook

Things that must be configured outside the code, and how each piece is verified.

## 1. Required environment variables

See `.env.example` for the full list (names only, no values).

| Variable | Why | Notes |
| --- | --- | --- |
| `RACE_MASTER_SEED` | Derives every race outcome | 32+ random characters. Must be set in production or races cannot run. Never rotate it mid-day: past outcomes stop verifying. |
| `CRON_SECRET` | Guards `POST /api/public/settle-due` | 32+ random characters. Only the scheduler should know it. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Deposits | Live values belong in the platform's secret store. |

## 2. Rotate exposed Razorpay credentials

The repository's `.env` was committed with live Razorpay credentials, and those values remain in git history.
Do this before launch:

1. In the Razorpay dashboard, regenerate the API key secret and the webhook secret.
2. Put the new values in the platform's secret store, not in `.env`.
3. Re-run a small test deposit to confirm the webhook still verifies.

Deleting the lines from `.env` does not remove them from history. Rotation is the only real fix.

## 3. Schedule the settlement sweep

Pending bets for finished rounds are normally settled when the player's wallet loads. The scheduled sweep
also pays out players who never come back. Call it once a minute:

```
POST https://<your-host>/api/public/settle-due
Authorization: Bearer <CRON_SECRET>
```

It returns `{ "settled": <number> }`. It is safe to call often, because settlement is idempotent.
Any scheduler works (Supabase `pg_cron` + `pg_net`, GitHub Actions, or an external cron service).
Store the secret in the scheduler's secret store, not in the SQL text.

Check it works: a `401` without the header, and `200` with it.

## 4. Database migrations

`supabase/migrations/20261008090000_apex_money_hardening.sql` must be applied before the new code goes live. It:

- stops bets from spending money reserved for a pending withdrawal;
- moves "today" (daily loss limit, bets today) to the Indian calendar day (IST).

## 5. Admin totals

Admin overview and player totals read every row, page by page (`selectAll` in `src/lib/admin.functions.ts`).
Before a large launch, check that the totals on the admin page match a direct SQL count.

## 6. Verifying changes

- `npm test`: race and odds engine checks (Node's built-in test runner, no extra dependencies).
- `npm run lint`: must report 0 errors. Six shadcn fast-refresh warnings are known and accepted.
- `npx tsc --noEmit` and `npm run build` must pass.

## 7. Decisions still open

- The ₹28 welcome bonus is currently withdrawable. Decide whether promo credit should be excluded from cash-out.
- Whether the daily loss limit should count pending (unsettled) bets as losses (current behaviour: yes).
