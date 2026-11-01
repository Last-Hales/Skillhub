# SkillHub consolidation notes

## Current application

Live AppDeploy app: https://skillhub-xui394.v2.appdeploy.ai/

The active app is React + TypeScript + Vite and uses AppDeploy-managed authentication, API, database, storage, and realtime services. The AppDeploy SDK packages are platform-injected; do not add `@appdeploy/client` or `@appdeploy/sdk` to the ordinary npm manifest.

## Current product capabilities

- Customer and worker accounts and profiles
- Worker skill listings, location, and availability
- Search and discovery of available workers
- Customer opportunities and worker applications
- Customer selection of applicants
- In-app job messaging and notifications
- Job completion confirmation and ratings
- Team-up opportunities, worker portfolios, saved workers, and reports
- Profile settings, logout, and light/dark appearance

## Legacy project consolidation

The previous repository included a separate Express/MongoDB/JWT implementation. Do not run that legacy server alongside the AppDeploy backend or copy its authentication, permissive CORS, or realtime room-handling code into the current application without a security review.

The old admin setup included a hard-coded default credential. Treat that credential as exposed: do not reuse it, and rotate it if it was ever used. Remove obsolete logs, generic template pages, and outdated setup instructions as part of cleanup.

## Security status

- The realtime subscription endpoints require authentication and limit subscriptions to job-chat entities where the signed-in user is a participant in the opportunity.
- Subscription removal is scoped to the authenticated user's own records.
- The platform reference reviewed so far does not establish a supported way to prove that a client-submitted realtime connection ID belongs to the authenticated user. This remains an open security item; do not mark realtime connection ownership as fully resolved until it is verified with a supported mechanism and tested.
- Job completion now records one uniquely keyed confirmation row per participant in `completionConfirmations`, then reads only the expected participant IDs with consistent keyed reads before finalizing. This removes the prior read-modify-write array overwrite and avoids scanning an unbounded confirmation table. It still needs simultaneous-request testing.
- Bootstrap and several list endpoints read bounded pages (for example, 100 profiles/opportunities, 500 applications/ratings/comments, and 100 messages) without consistently following pagination tokens. As the marketplace grows, users may see incomplete listings, applicant lists, ratings, comments, or chat history. Add deliberate pagination and ensure authorization is applied to every page.
- The bootstrap response returns a user's full own profile, including contact/address fields, while public worker cards are reduced to selected listing fields. Keep that distinction intentional; do not expose other users' full profile records in future changes.
- Keep secrets, identity documents, user data, and credentials out of source control.

## Important release notes

- The current verification feature submits a review request; it does not itself perform NIN or passport verification. Any identity check must use an authorised provider and secure handling.
- Standard service opportunities now use direct first-successful acceptance from the worker UI; the backend conditionally changes only an open opportunity to accepted. Team-Up posts retain applications and organiser selection. This is not yet proximity-first push dispatch: workers must discover the opportunity in the app, and real-world concurrent acceptance still needs integration testing.
- The live AppDeploy app has the validated resources `public/resources/skillhub-logo.jpg` and `public/resources/favicon.jpg`. The React landing page, onboarding screen and sidebar already reference `/resources/skillhub-logo.jpg`; `index.html` and the web manifest reference `/resources/favicon.jpg`. The binary resources are managed by AppDeploy and are not yet committed to GitHub, so a repository clone still needs those image files added for a fully portable source checkout.
- A GitHub clone is not yet independently buildable outside AppDeploy because the managed SDK services are injected by the platform. A standalone build needs compatible backend services or an explicitly documented AppDeploy development workflow.

## Release checklist

1. Resolve and test realtime connection ownership.
2. Make completion confirmation concurrency-safe and test simultaneous confirmations.
3. Add deliberate pagination to growing data collections and test beyond current page limits.
4. Transfer the logo and favicon binary files into the GitHub branch.
5. Review and remove obsolete legacy files without losing any useful, securely rebuilt admin features.
6. Run the AppDeploy QA suite and an independent production build/test workflow.
7. Confirm the proximity-first, first-accept dispatch behavior if it remains a product requirement.
8. Only then review and merge the consolidation branch.
