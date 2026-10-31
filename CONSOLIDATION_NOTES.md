# SkillHub

SkillHub is a service marketplace that connects customers with skilled workers by service and location.

## Current application

The active application is deployed on AppDeploy:
https://skillhub-xui394.v2.appdeploy.ai/

The current frontend is a React + TypeScript application and uses AppDeploy-managed authentication, API, and realtime services. A plain static GitHub Pages deployment is not a replacement for that backend.

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

The old admin setup included a hard-coded default credential. Treat that credential as exposed: do not reuse it, and rotate it if it was ever used. Remove obsolete logs, generic template pages, and outdated setup instructions as part of the cleanup.

## Important release notes

- The current verification feature submits a review request; it does not itself perform NIN or passport verification. Any identity check must use an authorised provider and secure handling.
- The current opportunity flow uses worker applications followed by customer selection. It should not be described as automatic “closest worker wins” dispatch unless that workflow is implemented and tested.
- Review access control for realtime subscription endpoints before production use.
- Keep secrets, identity documents, user data, and credentials out of source control.

## Development

Use the AppDeploy project environment for the current backend and managed SDK integrations. Before making this repository a standalone build, document and provision the required backend services and SDK dependencies, then run build and security tests.
