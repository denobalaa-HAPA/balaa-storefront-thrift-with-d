# Thrift With D — Static App

Customer storefront and web admin shell for Thrift With D. This repository is deployed to **Firebase Hosting** under the platform's multi-tenant project.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and set `VITE_API_URL` to the central backend API URL.
3. `npm run dev` — local preview
4. `npm run build` — output in `dist/`

## Deployment (Firebase Hosting)

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Configuration:** Uses `firebase.json` and `.firebaserc` targeting the `thrift-with-d` hosting site.
- **Deploy Command:**
  ```bash
  firebase deploy --only hosting:thrift-with-d
  ```

## What lives here

- `src/` — React storefront + admin UI
- `public/` — Static assets and manifest config

## Routes

- `/` — customer storefront
- `/#/admin` — seller web admin dashboard
- `/#/master-admin` — platform manager administration UI

