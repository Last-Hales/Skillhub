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


## Discovery pagination update

- The authenticated bootstrap response now includes continuation tokens for the profiles and opportunities tables after its initial bounded 100-record pages.
- The authenticated `GET /api/discovery-page` endpoint accepts those tokens and reads at most 100 profile records and 100 opportunity records per request. It returns updated tokens with the next batch.
- The Discover screen now offers a Load more results control when the relevant table has another page. Results are appended by record ID to avoid duplicate cards, and the existing client-side skill/location search runs across all pages loaded in the session.
- Pagination is incremental; the backend does not drain the tables in one request. This branch has not yet been exercised in AppDeploy QA.
- Remaining bounded-list caveats: ratings and applications are still read from fixed-size pages (500) for worker rating summaries and already-applied opportunity filtering. Saved-worker IDs and other bootstrap collections also retain their existing fixed limits. These require separate deliberate pagination or targeted lookups before large-scale completeness can be claimed.


## Discovery pagination efficiency fix

- The discovery-page endpoint now treats a missing feed cursor as an exhausted feed instead of restarting that table at page one. It only reads profiles/ratings when a profile cursor is supplied, and opportunities/applications when an opportunity cursor is supplied. This avoids duplicate first-page reads when one feed has ended while the other still has results.
- The page limits remain 100 profiles, 100 opportunities, and up to 500 supporting ratings/applications for the relevant feed. The fixed supporting-data limits remain a completeness caveat.


## My Jobs pagination update

- The authenticated bootstrap now returns separate continuation tokens for the opportunities and applications collections used by My Jobs.
- The authenticated `GET /api/my-jobs-page` endpoint advances only supplied cursors, reads at most 100 opportunity records and 500 application records per request, and uses keyed opportunity/profile lookups for records discovered through the application page.
- The Opportunities screen now offers a Load more of your jobs control and appends records by job ID.
- This is incremental bounded pagination, not an exhaustive one-shot scan. Applicant lists and worker rating summaries on a given job page are still constrained by the supporting application/rating pages read in that request; this remains a known completeness limitation until applicant data is separately paginated or fetched by targeted job query.
- The new flow has not yet been exercised in AppDeploy QA or a full TypeScript build.


## My Jobs keyed lookup correction

- The AppDeploy database contract specifies that `db.get(table, ids)` returns records in the same order as requested IDs but does not attach database IDs to the returned records. The My Jobs page endpoint now pairs each record with its requested ID by array position instead of relying on a record `.id` field.
- The endpoint can collect up to 600 opportunity IDs (100 direct opportunity records plus up to 500 application-linked job IDs), so it now splits keyed opportunity reads into batches of at most 500, respecting the SDK array limit.
- Worker profile lookups are also paired with their requested IDs by position. Applicant profile images backed by stored paths are resolved through the storage URL API before returning the page.
- Added QA coverage for ID preservation, the 500-key batch limit, and applicant image URLs. These are test scenarios only; no build or AppDeploy QA execution has been performed yet.


## Chat read-receipt lookup correction

- The chat read endpoint no longer scans the first 200 records in the global messages table, which could miss unread messages for conversations outside that global page.
- The frontend now sends the message IDs returned by each fetched conversation page (maximum 100). The authenticated endpoint verifies the caller is a job participant, resolves those IDs with a bounded keyed `db.get`, and marks only unread incoming messages belonging to that job as read.
- IDs from another job and the current user's own messages are ignored. This improves read-receipt correctness for loaded pages; it does not solve the separate global-cursor ordering/completeness limitation in chat history pagination.
- Added QA steps for page-scoped read receipts. No build or AppDeploy QA execution has been performed yet.


## Chat read-receipt lookup correction

- The authenticated `POST /api/messages/:jobId/read` endpoint now accepts a bounded list of message IDs (maximum 100), verifies each keyed record belongs to the requested job and was sent by another participant, and updates only those records. It no longer scans the first 200 global message records, which could miss unread messages for older conversations.
- Opening a conversation, refreshing it, and loading an older page now submit the IDs actually displayed on that page for read-receipt updates.
- This corrects read-receipt targeting but does not solve global-table cursor ordering or guarantee that a cursor page contains the next chronologically older messages for a specific conversation. That remains an open chat-history design limitation.
- Added QA coverage for cross-conversation ID rejection and bounded keyed read receipts. The scenario has not yet been executed in AppDeploy QA.


## Chat pagination QA correction

- Updated the chat pagination test so it no longer asserts that a global-table cursor page is necessarily older than the current conversation page. It now verifies duplicate-free merging while explicitly preserving the chronological ordering/completeness limitation.
- Removed duplicated read-receipt assertions in the QA scenario. Read-receipt behavior remains bounded to up to 100 caller-supplied message IDs, each checked against the authorized job and sender identity.
