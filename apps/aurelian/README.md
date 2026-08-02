# Aurelian web preview

Independent Next.js application for the future Aurelian website.

## Local and production commands

- Application path: `apps/aurelian`
- Install from repository root: `npm ci`
- Develop from repository root: `npm run dev:aurelian`
- Build from repository root: `npm run build:aurelian`

The app lifecycle builds the local Builder package and synchronizes catalog assets into `apps/aurelian/public/catalog-assets`. That directory is generated and must not be committed.

## Future deployment

Create a Vercel project with `apps/aurelian` as the application/root directory and use the workspace install/build commands above. The expected domain is `aurelianperfumes.com`; Cloudflare DNS connection is deliberately deferred. No application secrets are currently required.

Analytics vendor selection, the official contact channel, WhatsApp finalization, payment, and launch policy content remain future work.
