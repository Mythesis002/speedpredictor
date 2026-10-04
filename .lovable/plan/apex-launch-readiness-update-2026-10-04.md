# Apex launch-readiness update

## What will change
- Rebrand all customer-facing app text and page previews from Speed Predict to Apex, while preserving account compatibility and the existing published address.
- Present every customer-facing page inside a fixed 394px mobile canvas on larger screens, centered against a dark backdrop; phones continue using their full available width.
- Audit and repair launch-critical flows: sign-up/sign-in, wallet display, deposits, withdrawals, bet placement, round reveal/settlement, history, verification, profile controls, and owner access.
- Remove misleading or dead presentation, improve recoverable error states, and fix current framework/security warnings where doing so does not change the agreed money rules.
- Validate the principal signed-in journey at mobile and desktop dimensions, then report anything requiring manual Razorpay configuration.

## Technical details
- Use one shared app-shell constraint rather than page-by-page desktop sizing.
- Keep phone-to-account mapping unchanged so existing users can still sign in after the rename.
- Keep all balances, bets, payouts, race outcomes, and owner checks server-authoritative.
- Add focused automated checks for deterministic race and money-related helpers where feasible, plus live browser verification.
- Update project architecture guidance for the shared fixed-mobile presentation rule.

## Not included
- Changing the published domain automatically; it remains the current address unless separately changed.
- Inventing payment activity or test transactions. Real deposits still require correctly configured Razorpay credentials and webhook events.
