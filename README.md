This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

This project is set up to deploy automatically via the [Vercel Platform](https://vercel.com).

### Deployment Pipeline Setup

To set up the deployment pipeline:

1. **Link the Repository**: A human must manually link the GitHub repository within the Vercel dashboard.
2. **Environment Variables**: Configure the environment variables on Vercel's project settings dashboard under the Environment Variables section. Use the variables listed in [`.env.example`](./.env.example) as a reference:
   - `NEXT_PUBLIC_APP_ENV`
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `FIREBASE_ADMIN_PROJECT_ID`
   - `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `FIREBASE_ADMIN_PRIVATE_KEY`
3. **CI/CD Workflow**:
   - **Preview Deployments**: Pull requests (PRs) targeting the main branch automatically trigger preview deployments once the project is linked.
   - **Production Deployments**: Pushes or merges to the `main` branch automatically deploy to production once linked.

## Local Development Setup

To set up the project on a new development machine, follow these steps in order:

### 1. Prerequisites

Ensure you have the following installed:

- **Node.js**: Version `20.x`
- **npm**: Comes with Node.js
- **Git**
- **GitHub CLI (`gh`)**
- **Firebase CLI (`firebase-tools`)**: Installed globally via `npm install -g firebase-tools`
- **Vercel CLI (`vercel`)**: Installed globally via `npm install -g vercel`

### 2. Clone the Repository

Clone the project repository to your local machine:

```bash
git clone https://github.com/George-T83/Syllabus-Sense.git
cd Syllabus-Sense
```

### 3. Install Dependencies

Run the installation command. This will also automatically initialize Git hooks via Husky:

```bash
npm install
```

### 4. Authenticate CLIs and Link Vercel Project

To pull environment variables and work with external services, authenticate your command-line tools:

1. **GitHub CLI**:

   ```bash
   gh auth login
   ```

   Follow the prompts to log in to your GitHub account.

2. **Vercel CLI**:

   ```bash
   vercel login
   ```

   Log in using your Vercel credentials (or OAuth via GitHub).

3. **Link to the Vercel Project**:
   ```bash
   vercel link
   ```
   During execution, select the existing project scope and when prompted, link to the existing project: `george-dev1/syllabus-sense`.

### 5. Pull Environment Variables

Once linked, retrieve all Client and Admin environment secrets directly from Vercel without sharing raw env files by hand:

```bash
vercel env pull .env.local
```

This fetches the secrets stored in the cloud and writes them to a local `.env.local` file.

### 6. Firebase Authentication (if needed)

Authenticate the Firebase CLI:

```bash
firebase login
```

### 7. Run and Verify the App

Verify that everything is set up correctly by running the application and checks locally:

- **Start Development Server**:

  ```bash
  npm run dev
  ```

  Open [http://localhost:3000](http://localhost:3000) to confirm the app boots successfully.

- **Run Checks**:
  Verify code quality, build success, and tests match CI environment requirements:
  ```bash
  npm run lint    # Verifies there are no lint issues
  npm run test    # Runs the unit tests with Vitest
  npm run build   # Verifies production build succeeds locally
  ```

## Environment Strategy

This project uses a single Firebase project (`syllabus-sense`) across all environments, with data isolation achieved using Firebase's multi-database Firestore features and the Local Emulator Suite.

### 1. Multi-Database Setup & Data Isolation

- **Production Environment**: Connects to the `(default)` Firestore database.
- **Staging / Preview Environments**: Connects to a named `staging` Firestore database.
- **Local Development**: Connects to the named `staging` Firestore database by default, or optionally, to the Firebase Local Emulator Suite.

### 2. Firebase Auth Sharing

- Firebase Auth configuration and users are shared globally across all cloud environments. This is a known Firebase multi-database limitation and is accepted as a tradeoff for this free-tier project.

### 3. Local Emulator Suite

For risk-free local testing without affecting cloud database data, you can run the Firebase Local Emulator Suite:

1. Start the emulators:
   ```bash
   npm run emulators
   ```
2. Enable emulators in your local environment by setting the following variable in `.env.local`:
   ```env
   NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
   ```
3. When running, the client-side code will route to local ports:
   - Firebase Auth: port `9099`
   - Firestore: port `8080`
   - Firebase Storage: port `9199`
   - Emulator UI: port `4000`

### 4. Vercel Environment Mapping

When deploying on Vercel, the environment variable configuration maps as follows:

- **Production Vercel Environment**: `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` should be unset or set to `(default)`.
- **Preview / Development Vercel Environments**: `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` should be set to `staging`.
