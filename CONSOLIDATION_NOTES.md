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
- Standard service opportunities use direct first-successful acceptance from the worker UI; the backend conditionally changes only an open opportunity to accepted. Team-Up posts retain applications and organiser selection. This is not yet proximity-first push dispatch: workers must discover the opportunity in the app, and real-world concurrent acceptance still needs integration testing.
- The live AppDeploy app has the validated resources `public/resources/skillhub-logo.jpg` and `public/resources/favicon.jpg`. The React landing page, onboarding screen and sidebar already reference `/resources/skillhub-logo.jpg`; `index.html` and the web manifest reference `/resources/favicon.jpg`. The binary resources are managed by AppDeploy and are not yet committed to GitHub, so a repository clone still needs those image files added for a fully portable source checkout.
- The logo paths match AppDeploy's public-resource URL convention. A historical frontend log recorded a failed logo request; the resource inventory confirms the files are bound, but a fresh live browser check is still needed before claiming the logo renders successfully.
- A GitHub clone is not yet independently buildable outside AppDeploy because the managed SDK services are injected by the platform. A standalone build needs compatible backend services or an explicitly documented AppDeploy development workflow.

## Release checklist

1. Resolve and test realtime connection ownership.
2. Make completion confirmation concurrency-safe and test simultaneous confirmations.
3. Make supporting applicant, rating, application, and other growing collections complete through supported targeted queries or cursor pagination.
4. Transfer the logo and favicon binary files into the GitHub branch.
5. Review and remove obsolete legacy files without losing any useful, securely rebuilt admin features.
6. Run the AppDeploy QA suite and an independent production build/test workflow.
7. Confirm the proximity-first, first-accept dispatch behavior if it remains a product requirement.
8. Only then review and merge the consolidation branch.

## Discovery pagination update

- The authenticated bootstrap response includes continuation tokens for the profiles and opportunities tables after its initial bounded 100-record pages.
- The authenticated `GET /api/discovery-page` endpoint accepts those tokens and reads at most 100 profile records and 100 opportunity records per request. It returns updated tokens with the next batch.
- The Discover screen offers a Load more results control when the relevant table has another page. Results are appended by record ID to avoid duplicate cards, and the existing client-side skill/location search runs across all pages loaded in the session.
- Pagination is incremental; the backend does not drain the tables in one request. This branch has not yet been exercised in AppDeploy QA.
- Remaining supporting-data caveats: each discovery page still reads at most 500 ratings for worker rating summaries and at most 500 applications for already-applied opportunity filtering. Because the application read is a page of the global applications table rather than a job-scoped query, an application outside that page can cause an already-applied opportunity to appear again. Rating averages/counts can also be incomplete when a worker has more than 500 ratings. Do not describe these feeds as fully complete until the SDK supports an appropriate indexed query or those supporting collections are independently paginated.

## Discovery pagination efficiency fix

- The discovery-page endpoint treats a missing feed cursor as an exhausted feed instead of restarting that table at page one. It only reads profiles/ratings when a profile cursor is supplied, and opportunities/applications when an opportunity cursor is supplied. This avoids duplicate first-page reads when one feed has ended while the other still has results.
- The page limits remain 100 profiles, 100 opportunities, and up to 500 supporting ratings/applications for the relevant feed. The fixed supporting-data limits remain a completeness caveat.

## My Jobs pagination update

- The authenticated bootstrap returns separate continuation tokens for the opportunities and applications collections used by My Jobs.
- The authenticated `GET /api/my-jobs-page` endpoint advances only supplied cursors, reads at most 100 opportunity records and 500 application records per request, and uses keyed opportunity/profile lookups for records discovered through the application page.
- The Opportunities screen offers a Load more of your jobs control and appends records by job ID.
- The page-level completeness caveat is more specific than a general 500-record limit: applicant details are assembled only from the current applications cursor page. If that applications cursor is exhausted while additional opportunity pages remain, owner jobs on those later pages can be returned without their full applicant lists. If a job has more applications than fit in the current 500-record application page, only applicants in that page are included. Applicant profile lookups and rating summaries are therefore also limited to the records available in that page and the first 500 ratings.
- This endpoint must not be treated as a complete applicant-history API. A supported job-scoped application query or a separately paginated applicant panel is needed before completeness can be claimed.
- The new flow has not yet been exercised in AppDeploy QA or a full TypeScript build.

## My Jobs keyed lookup correction

- The AppDeploy database contract specifies that `db.get(table, ids)` returns records in the same order as requested IDs but does not attach database IDs to the returned records. The My Jobs page endpoint pairs each record with its requested ID by array position instead of relying on a record `.id` field.
- The endpoint can collect up to 600 opportunity IDs (100 direct opportunity records plus up to 500 application-linked job IDs), so it splits keyed opportunity reads into batches of at most 500, respecting the SDK array limit.
- Worker profile lookups are also paired with their requested IDs by position. Applicant profile images backed by stored paths are resolved through the storage URL API.
- Added QA coverage for ID preservation, the 500-key batch limit, and applicant image URLs. These are test scenarios only; no build or AppDeploy QA execution has been performed yet.

## Chat read-receipt lookup correction

- The authenticated `POST /api/messages/:jobId/read` endpoint accepts a bounded list of message IDs (maximum 100), verifies each keyed record belongs to the requested job and was sent by another participant, and updates only those records. It no longer scans the first 200 global message records.
- Opening a conversation, refreshing it, and loading an older page submit the IDs actually displayed on that page for read-receipt updates.
- IDs from another job and the current user's own messages are ignored. This corrects read-receipt targeting but does not solve global-table cursor ordering or guarantee that a cursor page contains the next chronologically older messages for a specific conversation. That remains an open chat-history design limitation.
- Added QA coverage for cross-conversation ID rejection and bounded keyed read receipts. The scenario has not yet been executed in AppDeploy QA.

## Chat pagination QA correction

- The chat pagination test does not assert that a global-table cursor page is necessarily older than the current conversation page. It verifies duplicate-free merging while explicitly preserving the chronological ordering/completeness limitation.


## Applicant-index architecture decision

- The preferred long-term design is a job-scoped applicant index so an applicant panel can page through one opportunity without scanning the global applications collection.
- The reviewed AppDeploy database contract supports bounded `db.list` pages and chosen physical IDs, but its `filter` is explicitly post-read and does not reduce read cost. A filtered page over the global applications table therefore is not an efficient or completeness-safe substitute for a job-scoped index.
- The contract also states that missing table catalogs must be created separately before application writes. The available AppDeploy tools and reviewed SDK reference do not expose or document that catalog-provisioning operation. Do not dynamically invent per-job table names and begin writing to them until the supported catalog workflow is confirmed.
- A single shared index table would still require scanning its global pages because the documented filter is post-read. Storing an unbounded applicant-ID array on each opportunity is also unsuitable because records have a 256 KiB limit and concurrent array read-modify-write updates can lose applicants.
- Therefore no applicant-index code has been added yet. This is an intentional safety stop, not a completed fix. Next required platform confirmation: how to provision a job-scoped partition/table (or an indexed query keyed by `jobId`) before any migration or write-path change.
- Once the storage primitive is confirmed, implement idempotent index writes alongside application creation, status synchronization for choose/cancel/team flows, a paginated owner-only applicant endpoint, and a migration/backfill plan for legacy application rows. Preserve the existing global applications records during rollout; do not switch reads until reconciliation proves the index complete.


## Applicant index provisioning and rollout design

- If AppDeploy confirms job-scoped logical tables, derive each table name from a stable, non-reversible safe encoding/hash of the opportunity ID (for example, a fixed-length lowercase hexadecimal digest with an `applicants_` prefix). Never put raw user-controlled IDs, colons, or arbitrary text into table names.
- Provision the table catalog as part of opportunity creation using the platform-supported provisioning mechanism. The current exposed tools do not include this operation, so this step remains blocked; do not assume that the first `db.add` auto-creates a catalog.
- Store one index row per application, keyed by a stable application ID. Keep the existing global `applications` row as the source of truth during rollout. Once catalog provisioning is supported, write the application and its job-scoped index row in one `db.transact` call so either both commit or neither does.
- Keep the index row's status synchronized with applied/accepted/declined/cancelled transitions using conditional patches. Selection and cancellation must page through the job-scoped table, not the global table's first 500 rows.
- Add an owner-only applicant endpoint that pages the one job-scoped table with `nextToken`, and resolves worker profiles by known IDs in batches of at most 500. Return explicit continuation state and never claim the applicant list is complete until the cursor is exhausted.
- Backfill legacy applications with a bounded cursor worker: checkpoint the global applications cursor, write idempotent index rows, and reconcile counts/statuses before switching reads. Do not drain the global table in a request or repeatedly rescan it. Keep legacy reads available until reconciliation succeeds.
- Required tests: applications beyond the first 500 global rows remain visible; multiple pages contain no duplicates or omissions; concurrent duplicate apply is idempotent; choose/cancel updates the index; non-owners cannot read applicants; backfill can resume from a checkpoint.
- Blocking confirmation requested from AppDeploy: the supported catalog-provisioning API/process, whether table catalogs can be provisioned dynamically per opportunity, and whether provisioned tables are available immediately to backend transactions. No supported operation is currently exposed in the available toolset, so implementation must wait for that confirmation.


## Team-Up selection atomicity correction

- Team-Up selection previously updated the opportunity's worker list first and the selected application status in a separate write. If the second write failed or raced with another update, the worker could be added to the team while their application remained `applied`.
- The selection path now composes the opportunity update and selected application conditional status update into one `db.transact` call. Both commit or neither commits; a failed condition returns a conflict response.
- Added a QA scenario for the atomic selection behavior. The scenario is defined but has not been executed.
- Remaining limitations: applicant discovery still reads only the first 500 global application records, so a valid application outside that page may not be selectable. Team membership updates can still race when multiple owners' requests use the same stale `workerIds` snapshot while the opportunity remains open; concurrency testing and a compare-and-set condition on the membership snapshot are still required. This change fixes the partial two-record write, not the broader team concurrency or applicant pagination problems.


## Realtime subscription scale and connection-ownership review

- `backend/realtime-subscribers.ts` currently reads only the first 1,000 rows from the global `entity_subscriptions` table for add, remove, cleanup, and notification fan-out. Because `db.list` filters are post-read and the route does not follow `nextToken`, a subscription beyond that first page can be missed: notifications may not reach a valid chat client, duplicate prevention can fail, and disconnect cleanup can leave stale rows.
- Replacing the 1,000-row cap with a loop over every cursor page inside a request is not an acceptable fix: the SDK explicitly says not to drain growing tables in a request or cron, and it would make each chat send increasingly expensive.
- Preferred design: a bounded subscription partition keyed by a safe deterministic hash of entity type + entity ID, with chosen IDs derived from a safe hash of user ID + connection ID. Then each notification reads only that entity's subscription page(s), with explicit handling if a single entity exceeds its page budget. This requires confirmation/provisioning of logical table catalogs before writes; the currently exposed tools do not provide that operation. A per-connection index for cleanup may be added only if it can be maintained atomically with the entity partition.
- Connection ownership: the current subscribe route authenticates the user and verifies job participation, but accepts `connection_id` from the request body and stores it without a documented server-side proof that the connection belongs to that authenticated user. The realtime SDK reference documents frontend `connection.connectionId` and backend `ws.send`, but no backend API to validate or bind a connection ID to an authenticated principal. Do not claim this is verified or invent a validation API. Request AppDeploy guidance for the supported connection-ownership verification/binding mechanism.
- Until those platform questions are answered, leave the existing realtime implementation unchanged rather than risk losing subscriptions or blocking chat. Required validation after a supported design exists: more than 1,000 total subscriptions across several chats; a target chat whose subscriptions fall beyond the old global first page; idempotent repeated subscribe; unsubscribe scoped to the caller's own connection; disconnect cleanup; unauthorized user cannot subscribe to another job; and a connection ID belonging to another user is rejected by platform-verified ownership.
- These are documented known limitations, not executed QA results.


## Application creation versus opportunity cancellation

- The worker apply route originally checked that an opportunity was open and then created the application in a separate write. A customer could cancel the opportunity between those operations, leaving a newly created application attached to a cancelled job.
- The apply route now composes the chosen-ID application insert and a conditional patch of the opportunity's `status: open` into one `db.transact`. If cancellation changes the opportunity first, the open-state condition aborts the application insert. If application creation commits first, cancellation observes the application in the subsequent state and can proceed under its own conditional transaction.
- Duplicate chosen application IDs abort the transaction; the route performs a consistent keyed lookup to distinguish the existing same-user application from a closed-job conflict. The stable application ID remains `<jobId>_<workerId>` after sanitization.
- Cancellation still enumerates only the first 500 global application records before changing their status. Because filters are post-read and no job-scoped applicant index is provisioned, applications beyond that page may remain `applied` after their job is cancelled. The cancelled job itself blocks further application attempts, but the historical application statuses may be stale. This remains a documented data-cleanup/indexing limitation, not a solved completeness guarantee.
- Required QA: race apply against cancel in both commit orders; verify no application can be created after cancellation wins; verify cancellation winning first causes the apply transaction to abort; repeat apply with the same worker and confirm no duplicate row; include a job with more than 500 applications to expose the remaining cancellation status-sync limitation.


## Team-Up membership compare-and-set

- The earlier Team-Up transaction made the opportunity update and selected application update atomic, but its opportunity condition checked only `status: open`. Two leaders' requests could both read the same `workerIds` snapshot, each append a different worker, and then overwrite one another while the Team-Up remained open.
- The Team-Up opportunity patch now also conditions on the exact `workerIds` value read before constructing the update. The database contract supports literal top-level field equality in conditional patches, including `undefined` to require that a field is absent.
- Concurrent additions based on the same membership snapshot can no longer both commit: one transaction wins and the other receives a conditional conflict; the losing leader must refresh and retry against the updated team. Its application status update remains in the same transaction, so a failed membership compare-and-set does not accept the application.
- This protects membership from lost updates but does not make team capacity allocation globally retry-free. The UI/API must treat a conflict as a refresh-and-retry outcome. Notification delivery remains after commit and is not transactionally coupled to membership.
- Required QA: start with an open Team-Up and one existing member; race two valid applicant selections from the same initial snapshot; verify exactly one new member and one accepted application commit, the losing application remains applied, and retrying from refreshed state adds the second worker without duplicates or exceeding teamSize.

## Chat cursor and read-receipt wiring correction

- The chat screen already sent the returned continuation token when requesting older messages, but the backend GET route previously ignored the query token and never returned a continuation token. The route now passes `query.nextToken` into the bounded 100-record `db.list` call and returns the page's `nextToken` (or null), so the existing client "Load older messages" flow can actually advance through cursor pages.
- The chat read-receipt endpoint now consumes the message IDs submitted by the client, deduplicates and caps them at 100, performs a consistent keyed lookup, and updates only records that belong to the requested job and were sent by another participant. It no longer scans the first 200 global message rows.
- These changes make pagination and read receipts match the existing frontend contract, but do not make history conversation-scoped: the database cursor still traverses the global messages table and the backend filters each bounded page for the requested job. A conversation can therefore have sparse pages, and chronological completeness/order across pages is not guaranteed. Do not label this as complete per-conversation pagination.
- Required QA: create interleaved messages across several jobs; verify the nextToken advances and pages do not repeat the same physical records; verify messages from other jobs are never returned; verify read receipts affect only submitted IDs from the active job and never the signed-in user's own messages; verify unauthorized users cannot retrieve or mark messages read. Separately test a long conversation whose messages are interleaved with high-volume traffic to quantify gaps caused by global cursor pagination.
- This remains a partial correction. A true conversation-scoped ordered query or provisioned conversation partition is still needed for complete chronological history. No AppDeploy QA or build has been run for this change.

## Job lifecycle route review: Team-Up acceptance guard

- The normal frontend uses the Team-Up application endpoint and organiser selection, but the separate single-worker `/accept` endpoint previously accepted any open opportunity without checking its kind. A direct API request could therefore bypass the Team-Up applicant/organiser workflow and assign a single worker to a Team-Up opportunity through the wrong state transition.
- The `/accept` route now rejects records with `kind: 'team'` and directs workers to the Team-Up application flow. The existing atomic open-status condition remains in place for ordinary job acceptance.
- Added a QA scenario confirming the direct accept request cannot mutate Team-Up status or membership and that the normal apply/choose flow remains available.
- Remaining lifecycle release checks: execute accept-vs-cancel races; verify Team-Up selection/capacity under concurrent requests; verify mutual completion across all required team members; confirm the `completionConfirmations` table catalog is provisioned before writes; and verify rating semantics for multi-worker Team-Ups. The current rating ID is one per job and rater, so a Team-Up participant cannot submit separate ratings for multiple teammates through the existing route. No runtime QA or independent build has been run for this review.
