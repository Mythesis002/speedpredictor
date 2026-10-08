<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Render all customer and owner routes inside the shared 394px app shell on wider screens, because Apex intentionally preserves its mobile-game form factor on desktop.
- Preserve the legacy `@speedpredict.app` synthetic auth email mapping, because changing it would lock existing phone-number accounts out after the Apex rebrand.
- Money rules stay server-side. Every balance change goes through a SQL function (`place_bet`, `settle_bet`, `credit_deposit`, `request_withdrawal`, `process_withdrawal`). Never update `profiles.balance_paise` directly from application code.
- Pending bets on finished rounds must always be settleable without the browser: keep `settleFinishedBets` (wallet load + `/api/public/settle-due`) working when changing the race or bet flow.
- Admin reads of whole tables must use `selectAll` (paged). PostgREST silently caps unpaged reads at 1,000 rows.
- "Today" for money and stats is the Indian calendar day (IST), not UTC.
- Files under `src/integrations/supabase/` and `src/routeTree.gen.ts` are generated; do not hand-format or hand-edit them.
- Run `npm test` (race/odds engine checks, no extra dependencies) before committing changes to `src/lib/round-engine.ts`. Keep `bun.lock` in sync with `package.json`.
- Operational setup (env vars, the settlement schedule, migrations, credential rotation) lives in `docs/OPERATIONS.md`.
