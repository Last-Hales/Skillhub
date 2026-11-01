# SkillHub

SkillHub is a service marketplace that helps customers discover skilled workers and helps workers find service opportunities.

## Current application

The active codebase is a React 19 + Vite + TypeScript single-page application with an AppDeploy-managed backend and authentication.

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

The AppDeploy runtime supplies `@appdeploy/client` to the frontend and `@appdeploy/sdk` to backend code. These platform-managed SDKs are intentionally not listed as npm dependencies. Backend routes require the AppDeploy runtime and cannot be run as a standalone Express server.

## Main capabilities

- Customer and worker accounts
- Worker profiles, skills, locations and availability
- Search and discovery
- Customer opportunities; direct first-successful acceptance for standard service jobs; team-up applications and organiser selection
- In-app messaging and notifications
- Ratings and completion workflows
- Saved workers, portfolios and reporting

Some product goals remain under development. First-successful acceptance is wired for standard service jobs, but proximity-first push dispatch is not implemented. Independent identity verification and production-grade realtime connection ownership checks are also incomplete. Job completion uses per-participant confirmation records with consistent keyed reads; simultaneous confirmation tests are still required.

## Repository status

The `consolidate/new-skillhub-app` branch is the current consolidation branch. It is not a production release. Validate the AppDeploy SDK integration, backend authorization, build and end-to-end workflows before merging it into `main`.

The original legacy Express/MongoDB implementation is being retired; its JWT, Socket.IO and database setup instructions no longer describe this application.
