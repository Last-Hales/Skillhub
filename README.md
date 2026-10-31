# SkillHub

SkillHub is a service marketplace connecting customers with skilled workers by service and location.

## Current application

The current application is a React + TypeScript + Vite frontend with AppDeploy-managed authentication, backend APIs, database access, and realtime services.

Live app: https://skillhub-xui394.v2.appdeploy.ai/

This repository's `consolidate/new-skillhub-app` branch is the consolidation branch. The AppDeploy-managed SDK packages are injected by that platform and are intentionally not listed as ordinary npm dependencies. A standalone deployment requires replacing those managed services or providing compatible implementations.

## Current features

- Customer and worker registration and profiles
- Worker skills, service descriptions, location, and availability
- Search and discovery by skill and area
- Customer opportunities and worker applications
- Customer review and selection of applicants
- In-app job conversations and notifications
- Job completion confirmation and ratings
- Team-up opportunities and group conversations
- Worker portfolios, saved workers, reports, and cancellation history
- Profile settings, logout, and dark mode

## Important product limitations

- The opportunity flow currently uses worker applications followed by customer selection. It does not yet implement automatic proximity-first dispatch where the first worker to accept gets the job.
- The verification feature is a request for review; it does not independently verify NIN, passports, or identity documents.
- Payment processing is not represented as a completed feature.
- Realtime subscription routes now require authentication and check access to the related job conversation. Ownership verification for the submitted realtime connection ID still needs a supported platform mechanism and testing before production approval.

## Development and deployment

The frontend uses React 19, TypeScript, Vite 6, Tailwind CSS, and lucide-react. AppDeploy provides the runtime integration for `@appdeploy/client` in the frontend and `@appdeploy/sdk` in backend routes.

The platform SDK imports are not normal public npm dependencies. Use the AppDeploy project environment for a working build unless the managed APIs are replaced with standalone equivalents.

Typical frontend scripts:

```bash
npm install
npm run dev
npm run build
```

These commands alone do not provision the AppDeploy backend services.

## Security and operations

- Do not commit API keys, passwords, identity documents, or private user data.
- The legacy repository's hard-coded default admin credential must never be reused. Rotate it if it was ever used.
- Do not revive the legacy Express/MongoDB/JWT server or its permissive CORS and Socket.io room handlers alongside the current AppDeploy backend without a separate security review.
- Before production approval, test authentication and authorization, realtime connection ownership, data access boundaries, uploads, and all core customer/worker workflows.

## Support

Email: skill.hub.gtt@gmail.com
WhatsApp: 09015210112
