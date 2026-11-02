# SkillHub

SkillHub is a service marketplace that helps customers discover skilled workers and helps workers find service opportunities.

## Current application

The active codebase is a React 19 + Vite + TypeScript single-page application with an AppDeploy-managed backend and authentication. The SkillHub logo and favicon are configured at `/resources/skillhub-logo.jpg` and `/resources/favicon.jpg` in the AppDeploy app.

- Frontend: `src/`
- Backend routes and realtime handlers: `backend/`
- Static public resources: `public/`
- App tests: `tests/tests.json`

## Development

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Create a production frontend build with:

```bash
npm run build
```

The AppDeploy runtime supplies `@appdeploy/client` to the frontend and `@appdeploy/sdk` to backend code. These platform-managed SDKs are intentionally not listed as npm dependencies. Backend routes require the AppDeploy runtime and cannot be run as a standalone Express server. A successful local build has not yet been recorded for this branch.

## Main capabilities

- Customer and worker accounts
- Worker profiles, skills, locations and availability
- Search and discovery
- Customer opportunities; direct first-successful acceptance for standard service jobs; team-up applications and organiser selection
- In-app messaging and notifications (history pagination is bounded, but per-conversation chronological cursor ordering remains to be verified)
- Ratings and completion workflows
- Saved workers, portfolios and reporting

## Known completeness and release limitations

- Discovery pagination advances through profiles and opportunities, but supporting application and rating reads remain capped at 500 records per request. Already-applied jobs can reappear if the matching application is outside the loaded application page; rating summaries can be incomplete.
- My Jobs pagination advances through opportunities and applications separately. Applicant lists are assembled from the current applications page only, so a later opportunity page may not contain its complete applicant list, especially after the application cursor is exhausted. A job with more than 500 applications may also have a partial list.
- Chat history uses a cursor over the global messages table. The cursor does not guarantee chronological ordering or completeness for an individual conversation.
- Job completion uses per-participant confirmation records with consistent keyed reads; simultaneous confirmation tests are still required.
- Standard first-successful acceptance is implemented, but proximity-first push dispatch is not.
- The current verification feature submits a review request; it does not itself perform NIN or passport verification.
- Production-grade realtime connection ownership checks are incomplete; the reviewed SDK reference does not establish a supported way to prove that a submitted connection ID belongs to the authenticated user.
- The logo and favicon paths follow AppDeploy's public-resource convention and the resources are bound to the app. A historical failed logo request still requires a fresh live browser check.

## Repository status

The `consolidate/new-skillhub-app` branch is the current consolidation branch. It is not a production release. Validate the AppDeploy SDK integration, backend authorization, build and end-to-end workflows before merging it into `main`.

The original legacy Express/MongoDB implementation is being retired; its JWT, Socket.IO and database setup instructions no longer describe this application.
