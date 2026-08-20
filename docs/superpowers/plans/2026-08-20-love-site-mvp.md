# Love Site MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP of a Christian dating site — auth, profiles, discovery, mutual-like matching, basic messaging, reporting/blocking, and an admin report-management panel.

**Architecture:** A single Next.js (App Router) project. Server logic lives in small, independently testable modules under `src/lib/`; each API route (`src/app/api/**/route.ts`) is a thin wrapper that authenticates the session and delegates to a `lib` function. PostgreSQL via Prisma is the only datastore. Photos go to an S3-compatible bucket (Cloudflare R2 for the Vercel demo, MinIO on the VPS later) so the storage code never changes between environments — only endpoint/credentials env vars do.

**Tech Stack:** Next.js 14 (App Router, TypeScript, src dir), Prisma + PostgreSQL, NextAuth v4 (Credentials provider, JWT sessions), bcryptjs, zod, @aws-sdk/client-s3, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-love-site-design.md`

## Global Constraints

- Matching is **always heterosexual and enforced server-side** — there is no "genre recherché" field and no client-controlled parameter can change who a user is shown. (spec: Modèle de données / Profile, Fonctionnalités / Découverte)
- `Profile.gender` only ever takes the values `homme` or `femme`. (spec: Modèle de données / Profile)
- No Vercel-proprietary API (Blob, KV, Edge Config, etc.) may be used anywhere — storage must go through the S3-compatible client so the app runs unchanged on the VPS. (spec: Stack technique / Déploiement)
- No manual photo moderation in the MVP — uploaded photos are visible immediately. (spec: Sécurité, Hors scope)
- No real-time transport requirement — polling/refresh is an acceptable messaging UX for the MVP. (spec: Fonctionnalités / Messagerie)
- Passwords are always stored as bcrypt hashes, never in plaintext. (spec: Sécurité)
- Interface language is French throughout. (spec: Stack technique)

---

## Task 1: Project scaffolding & tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `.eslintrc.json` (via `create-next-app`)
- Create: `docker-compose.yml`
- Create: `.env.example`, `.env` (gitignored)
- Create: `vitest.config.ts`
- Create: `src/lib/env.ts`
- Test: `tests/env.test.ts`

**Interfaces:**
- Produces: `loadEnv(source?: NodeJS.ProcessEnv): { DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_BASE_URL }` — throws on missing/invalid vars.

- [ ] **Step 1: Scaffold the Next.js project**

Run:
```bash
npx create-next-app@latest . --typescript --eslint --app --src-dir --import-alias "@/*" --no-tailwind --use-npm
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install prisma @prisma/client next-auth bcryptjs zod @aws-sdk/client-s3
npm install -D vitest tsx @types/bcryptjs dotenv
```

- [ ] **Step 3: Initialize Prisma**

Run:
```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 4: Add a local Postgres via docker-compose**

Create `docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: love_site
      POSTGRES_PASSWORD: love_site
      POSTGRES_DB: love_site
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
```

Run: `docker compose up -d`
Expected: the `db` container is `Up` (check with `docker compose ps`).

- [ ] **Step 5: Configure environment variables**

Create `.env.example`:
```
DATABASE_URL="postgresql://love_site:love_site@localhost:5432/love_site"
NEXTAUTH_SECRET="change-me"
NEXTAUTH_URL="http://localhost:3000"
S3_ENDPOINT="http://localhost:9000"
S3_REGION="auto"
S3_BUCKET="love-site-photos"
S3_ACCESS_KEY_ID="change-me"
S3_SECRET_ACCESS_KEY="change-me"
S3_PUBLIC_BASE_URL="http://localhost:9000/love-site-photos"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="change-me"
```

Copy it to `.env` and fill in real values (for local dev, the `DATABASE_URL` above matches the docker-compose service; S3 values can stay as placeholders until Task 6).

Add `.env` to `.gitignore` if `create-next-app` didn't already.

- [ ] **Step 6: Configure Vitest with the `@/*` alias**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
  },
})
```

Add to `package.json` `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Write the failing test for environment validation**

Create `tests/env.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { loadEnv } from '@/lib/env'

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/love_site',
  NEXTAUTH_SECRET: 'test-secret',
  NEXTAUTH_URL: 'http://localhost:3000',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'auto',
  S3_BUCKET: 'love-site-photos',
  S3_ACCESS_KEY_ID: 'test-key',
  S3_SECRET_ACCESS_KEY: 'test-secret-key',
  S3_PUBLIC_BASE_URL: 'http://localhost:9000/love-site-photos',
} satisfies NodeJS.ProcessEnv

describe('loadEnv', () => {
  it('accepts a complete valid environment', () => {
    expect(() => loadEnv(validEnv)).not.toThrow()
  })

  it('throws when a required variable is missing', () => {
    const { DATABASE_URL, ...incomplete } = validEnv
    expect(() => loadEnv(incomplete as NodeJS.ProcessEnv)).toThrow()
  })
})
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npm test -- tests/env.test.ts`
Expected: FAIL — `Cannot find module '@/lib/env'`

- [ ] **Step 9: Implement `src/lib/env.ts`**

```ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_PUBLIC_BASE_URL: z.string().min(1),
})

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`)
  }
  return parsed.data
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm test -- tests/env.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 11: Verify the app builds**

Run: `npm run build`
Expected: build succeeds with the default Next.js starter page.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with Prisma, Vitest, and env validation"
```

---

## Task 2: Database schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `tests/helpers/db.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` from `.env` (Task 1)
- Produces: `prisma` (singleton `PrismaClient` from `src/lib/db.ts`); `resetDb(): Promise<void>` (test helper that truncates all app tables); the full Prisma-generated model/enum types (`User`, `Profile`, `Like`, `Match`, `Message`, `Report`, `Block`, `Role`, `Gender`, `Denomination`, `ChurchAttendance`, `ReportCategory`, `ReportStatus`) consumed by every later task.

- [ ] **Step 1: Write the schema**

Replace the contents of `prisma/schema.prisma` with:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  user
  admin
}

enum Gender {
  homme
  femme
}

enum Denomination {
  evangelique
  catholique
  protestant
  orthodoxe
  autre
}

enum ChurchAttendance {
  regulierement
  occasionnellement
  rarement
}

enum ReportCategory {
  faux_profil
  comportement_inapproprie
  contenu_offensant
  autre
}

enum ReportStatus {
  en_attente
  traite
  ignore
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(user)
  suspended    Boolean  @default(false)
  createdAt    DateTime @default(now())

  profile        Profile?
  likesSent      Like[]    @relation("LikesSent")
  likesReceived  Like[]    @relation("LikesReceived")
  matchesAsA     Match[]   @relation("MatchUserA")
  matchesAsB     Match[]   @relation("MatchUserB")
  messagesSent   Message[]
  reportsFiled   Report[]  @relation("ReportsFiled")
  reportsAgainst Report[]  @relation("ReportsAgainst")
  blocksMade     Block[]   @relation("BlocksMade")
  blocksReceived Block[]   @relation("BlocksReceived")
}

model Profile {
  userId               String           @id
  user                 User             @relation(fields: [userId], references: [id])
  firstName            String
  birthDate            DateTime
  gender               Gender
  city                 String
  country              String
  bio                  String
  denomination         Denomination
  churchAttendance     ChurchAttendance
  marriageVision       String
  favoriteVerseOrValue String
  photos               String[]         @default([])
}

model Like {
  id         String   @id @default(uuid())
  fromUserId String
  toUserId   String
  createdAt  DateTime @default(now())

  fromUser User @relation("LikesSent", fields: [fromUserId], references: [id])
  toUser   User @relation("LikesReceived", fields: [toUserId], references: [id])

  @@unique([fromUserId, toUserId])
}

model Match {
  id        String   @id @default(uuid())
  userAId   String
  userBId   String
  createdAt DateTime @default(now())

  userA    User      @relation("MatchUserA", fields: [userAId], references: [id])
  userB    User      @relation("MatchUserB", fields: [userBId], references: [id])
  messages Message[]

  @@unique([userAId, userBId])
}

model Message {
  id       String   @id @default(uuid())
  matchId  String
  senderId String
  content  String
  sentAt   DateTime @default(now())
  read     Boolean  @default(false)

  match  Match @relation(fields: [matchId], references: [id])
  sender User  @relation(fields: [senderId], references: [id])
}

model Report {
  id             String         @id @default(uuid())
  reporterId     String
  reportedUserId String
  category       ReportCategory
  reason         String
  status         ReportStatus   @default(en_attente)
  createdAt      DateTime       @default(now())

  reporter     User @relation("ReportsFiled", fields: [reporterId], references: [id])
  reportedUser User @relation("ReportsAgainst", fields: [reportedUserId], references: [id])
}

model Block {
  id            String   @id @default(uuid())
  blockerId     String
  blockedUserId String
  createdAt     DateTime @default(now())

  blocker     User @relation("BlocksMade", fields: [blockerId], references: [id])
  blockedUser User @relation("BlocksReceived", fields: [blockedUserId], references: [id])

  @@unique([blockerId, blockedUserId])
}
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name init`
Expected: migration applies cleanly against the docker-compose database, Prisma Client is generated.

- [ ] **Step 3: Create the Prisma client singleton**

Create `src/lib/db.ts`:
```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 4: Create the test DB reset helper**

Create `tests/helpers/db.ts`:
```ts
import { prisma } from '@/lib/db'

export async function resetDb() {
  await prisma.message.deleteMany()
  await prisma.match.deleteMany()
  await prisma.like.deleteMany()
  await prisma.report.deleteMany()
  await prisma.block.deleteMany()
  await prisma.profile.deleteMany()
  await prisma.user.deleteMany()
}
```

- [ ] **Step 5: Write the failing test**

Create `tests/db.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

describe('database schema', () => {
  it('creates and retrieves a user with default role and suspended flag', async () => {
    const user = await prisma.user.create({
      data: { email: 'test@example.com', passwordHash: 'hashed' },
    })

    const found = await prisma.user.findUnique({ where: { id: user.id } })

    expect(found?.email).toBe('test@example.com')
    expect(found?.role).toBe('user')
    expect(found?.suspended).toBe(false)
  })
})
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- tests/db.test.ts`
Expected: PASS (this test should pass immediately since the schema and client already exist — it's confirming the migration is correct, not driving new code)

- [ ] **Step 7: Commit**

```bash
git add prisma src/lib/db.ts tests/helpers/db.ts tests/db.test.ts
git commit -m "feat: add Prisma schema for users, profiles, likes, matches, messages, reports, blocks"
```

---

## Task 3: Password hashing & registration

**Files:**
- Create: `src/lib/password.ts`
- Create: `src/app/api/register/route.ts`
- Test: `tests/password.test.ts`
- Test: `tests/register.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2)
- Produces: `hashPassword(password: string): Promise<string>`; `verifyPassword(password: string, hash: string): Promise<boolean>` — both consumed by Task 4 (login).

- [ ] **Step 1: Write the failing test for password hashing**

Create `tests/password.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'

describe('password hashing', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('S3cret!Pass')
    expect(hash).not.toBe('S3cret!Pass')
    expect(await verifyPassword('S3cret!Pass', hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('S3cret!Pass')
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/password.test.ts`
Expected: FAIL — `Cannot find module '@/lib/password'`

- [ ] **Step 3: Implement `src/lib/password.ts`**

```ts
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/password.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for registration**

Create `tests/register.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/register/route'
import { prisma } from '@/lib/db'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/register', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never // NextRequest is a superset consumed the same way here
}

describe('POST /api/register', () => {
  it('creates a user with a hashed password', async () => {
    const response = await POST(makeRequest({ email: 'alice@example.com', password: 'S3cret!Pass' }))
    expect(response.status).toBe(201)

    const user = await prisma.user.findUnique({ where: { email: 'alice@example.com' } })
    expect(user).not.toBeNull()
    expect(user?.passwordHash).not.toBe('S3cret!Pass')
  })

  it('rejects an invalid email', async () => {
    const response = await POST(makeRequest({ email: 'not-an-email', password: 'S3cret!Pass' }))
    expect(response.status).toBe(400)
  })

  it('rejects a duplicate email', async () => {
    await POST(makeRequest({ email: 'alice@example.com', password: 'S3cret!Pass' }))
    const response = await POST(makeRequest({ email: 'alice@example.com', password: 'AnotherPass1' }))
    expect(response.status).toBe(409)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- tests/register.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/register/route'`

- [ ] **Step 7: Implement `src/app/api/register/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = registerSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const { email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'email_taken' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({ data: { email, passwordHash } })

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- tests/register.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Add a minimal registration page**

Create `src/app/(auth)/register/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      setError("Impossible de créer le compte. Vérifiez l'email et le mot de passe.")
      return
    }

    router.push('/login')
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Créer un compte</h1>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Mot de passe
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">S'inscrire</button>
    </form>
  )
}
```

- [ ] **Step 10: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/register`, submit the form with a valid email/password, confirm you're redirected to `/login` and the user row exists (`npx prisma studio`).

- [ ] **Step 11: Commit**

```bash
git add src/lib/password.ts src/app/api/register src/app/\(auth\)/register tests/password.test.ts tests/register.test.ts
git commit -m "feat: add password hashing and user registration"
```

---

## Task 4: Login (NextAuth Credentials)

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/(auth)/login/page.tsx`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword` (Task 3); `prisma` (Task 2)
- Produces: `authorizeCredentials(email: string, password: string): Promise<{ id: string; email: string; role: string } | null>`; `authOptions: NextAuthOptions` — both consumed by every later task that needs `getServerSession(authOptions)`.

- [ ] **Step 1: Write the failing test**

Create `tests/auth.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { authorizeCredentials } from '@/lib/auth'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

describe('authorizeCredentials', () => {
  it('returns the user when credentials are correct', async () => {
    const passwordHash = await hashPassword('S3cret!Pass')
    const user = await prisma.user.create({ data: { email: 'alice@example.com', passwordHash } })

    const result = await authorizeCredentials('alice@example.com', 'S3cret!Pass')

    expect(result).toEqual({ id: user.id, email: user.email, role: 'user' })
  })

  it('returns null for a wrong password', async () => {
    const passwordHash = await hashPassword('S3cret!Pass')
    await prisma.user.create({ data: { email: 'alice@example.com', passwordHash } })

    expect(await authorizeCredentials('alice@example.com', 'wrong')).toBeNull()
  })

  it('returns null for an unknown email', async () => {
    expect(await authorizeCredentials('nobody@example.com', 'whatever')).toBeNull()
  })

  it('returns null for a suspended user even with the correct password', async () => {
    const passwordHash = await hashPassword('S3cret!Pass')
    await prisma.user.create({
      data: { email: 'alice@example.com', passwordHash, suspended: true },
    })

    expect(await authorizeCredentials('alice@example.com', 'S3cret!Pass')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/auth.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth'`

- [ ] **Step 3: Implement `src/lib/auth.ts`**

```ts
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

export async function authorizeCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || user.suspended) return null

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null

  return { id: user.id, email: user.email, role: user.role }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        return authorizeCredentials(credentials.email, credentials.password)
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as { id?: string; role?: string }).id = token.id as string
        ;(session.user as { id?: string; role?: string }).role = token.role as string
      }
      return session
    },
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/auth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire up the NextAuth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:
```ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 6: Add the login page**

Create `src/app/(auth)/login/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const result = await signIn('credentials', { email, password, redirect: false })

    if (result?.error) {
      setError('Email ou mot de passe incorrect.')
      return
    }

    router.push('/discover')
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Se connecter</h1>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Mot de passe
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">Se connecter</button>
    </form>
  )
}
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, register a user via `/register`, then log in via `/login`. Confirm you're redirected to `/discover` (it doesn't exist yet — a 404 there is expected until Task 7; the important check is that login itself succeeds without error).

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth.ts "src/app/api/auth" "src/app/(auth)/login" tests/auth.test.ts
git commit -m "feat: add Credentials login via NextAuth, reject suspended users"
```

---

## Task 5: Profile creation & editing

**Files:**
- Create: `src/lib/profile.ts`
- Create: `src/app/api/profile/route.ts`
- Create: `src/app/profile/edit/page.tsx`
- Test: `tests/profile.test.ts`
- Test: `tests/profile-route.test.ts`

**Interfaces:**
- Consumes: `authOptions` (Task 4); `prisma` (Task 2)
- Produces: `profileInputSchema` (zod), `calculateAge(birthDate, now?)`, `upsertProfile(userId, input, photos?)` — consumed by Task 6 (photo upload appends to the same `photos` array).

- [ ] **Step 1: Write the failing tests for the profile logic**

Create `tests/profile.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { calculateAge, profileInputSchema, upsertProfile } from '@/lib/profile'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

describe('calculateAge', () => {
  it('computes age correctly before the birthday this year', () => {
    expect(calculateAge(new Date('2000-06-15'), new Date('2026-06-01'))).toBe(25)
  })

  it('computes age correctly on or after the birthday this year', () => {
    expect(calculateAge(new Date('2000-06-15'), new Date('2026-06-20'))).toBe(26)
  })
})

const validInput = {
  firstName: 'Alice',
  birthDate: '2000-01-01',
  gender: 'femme',
  city: 'Paris',
  country: 'France',
  bio: 'Bio',
  denomination: 'catholique',
  churchAttendance: 'regulierement',
  marriageVision: 'Fonder une famille unie dans la foi',
  favoriteVerseOrValue: 'Philippiens 4:13',
}

describe('profileInputSchema', () => {
  it('accepts a valid profile', () => {
    expect(profileInputSchema.safeParse(validInput).success).toBe(true)
  })

  it('rejects someone under 18', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(profileInputSchema.safeParse({ ...validInput, birthDate: today }).success).toBe(false)
  })

  it('rejects a gender value outside homme/femme', () => {
    expect(profileInputSchema.safeParse({ ...validInput, gender: 'autre' }).success).toBe(false)
  })
})

describe('upsertProfile', () => {
  it('creates a profile for a user', async () => {
    const user = await prisma.user.create({
      data: { email: 'alice@example.com', passwordHash: 'hashed' },
    })
    const parsed = profileInputSchema.parse(validInput)

    const profile = await upsertProfile(user.id, parsed)

    expect(profile.firstName).toBe('Alice')
    expect(profile.photos).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/profile.test.ts`
Expected: FAIL — `Cannot find module '@/lib/profile'`

- [ ] **Step 3: Implement `src/lib/profile.ts`**

```ts
import { z } from 'zod'
import { prisma } from '@/lib/db'

export function calculateAge(birthDate: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear()
  const hasHadBirthdayThisYear =
    now.getMonth() > birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate())
  if (!hasHadBirthdayThisYear) age -= 1
  return age
}

export const profileInputSchema = z.object({
  firstName: z.string().min(1),
  birthDate: z.coerce
    .date()
    .refine((date) => calculateAge(date) >= 18, { message: 'age_minimum_18' }),
  gender: z.enum(['homme', 'femme']),
  city: z.string().min(1),
  country: z.string().min(1),
  bio: z.string().min(1),
  denomination: z.enum(['evangelique', 'catholique', 'protestant', 'orthodoxe', 'autre']),
  churchAttendance: z.enum(['regulierement', 'occasionnellement', 'rarement']),
  marriageVision: z.string().min(1),
  favoriteVerseOrValue: z.string().min(1),
})

export type ProfileInput = z.infer<typeof profileInputSchema>

export async function upsertProfile(userId: string, input: ProfileInput, photos?: string[]) {
  return prisma.profile.upsert({
    where: { userId },
    create: { userId, ...input, photos: photos ?? [] },
    update: { ...input, ...(photos ? { photos } : {}) },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/profile.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Write the failing test for the profile API route**

Create `tests/profile-route.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/profile/route'
import { prisma } from '@/lib/db'
import { resetDb } from './helpers/db'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
import { getServerSession } from 'next-auth'

afterEach(async () => {
  vi.clearAllMocks()
  await resetDb()
})

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/profile', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never
}

describe('/api/profile', () => {
  it('rejects unauthenticated requests', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('creates a profile for the authenticated user', async () => {
    const user = await prisma.user.create({
      data: { email: 'alice@example.com', passwordHash: 'hashed' },
    })
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id } } as never)

    const response = await POST(
      makeRequest({
        firstName: 'Alice',
        birthDate: '2000-01-01',
        gender: 'femme',
        city: 'Paris',
        country: 'France',
        bio: 'Bio',
        denomination: 'catholique',
        churchAttendance: 'regulierement',
        marriageVision: 'Fonder une famille unie dans la foi',
        favoriteVerseOrValue: 'Philippiens 4:13',
      })
    )

    expect(response.status).toBe(200)
    const saved = await prisma.profile.findUnique({ where: { userId: user.id } })
    expect(saved?.firstName).toBe('Alice')
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- tests/profile-route.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/profile/route'`

- [ ] **Step 7: Implement `src/app/api/profile/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { profileInputSchema, upsertProfile } from '@/lib/profile'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: (session.user as { id: string }).id },
  })

  return NextResponse.json(profile)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = profileInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 })
  }

  const profile = await upsertProfile((session.user as { id: string }).id, parsed.data)
  return NextResponse.json(profile, { status: 200 })
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- tests/profile-route.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: Add the profile edit page**

Create `src/app/profile/edit/page.tsx` with a form covering every `profileInputSchema` field (text inputs for `firstName`/`city`/`country`/`bio`/`marriageVision`/`favoriteVerseOrValue`, a date input for `birthDate`, `<select>` for `gender`/`denomination`/`churchAttendance`), `onSubmit` posting JSON to `/api/profile` the same way `register/page.tsx` posts to `/api/register` (Task 3, Step 9). Reuse that pattern directly.

- [ ] **Step 10: Manual verification**

Run: `npm run dev`, log in, visit `/profile/edit`, submit the form, confirm `npx prisma studio` shows the saved profile.

- [ ] **Step 11: Commit**

```bash
git add src/lib/profile.ts src/app/api/profile src/app/profile tests/profile.test.ts tests/profile-route.test.ts
git commit -m "feat: add profile creation and editing"
```

---

## Task 6: Photo upload (S3-compatible storage)

**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/app/api/upload/route.ts`
- Modify: `src/app/profile/edit/page.tsx` (add a file input wired to `/api/upload`)
- Test: `tests/storage.test.ts`
- Test: `tests/upload-route.test.ts`

**Interfaces:**
- Consumes: `authOptions` (Task 4), `prisma` (Task 2)
- Produces: `uploadPhoto(fileBuffer: Buffer, contentType: string): Promise<string>` (returns the public URL) — used only by the upload route in this MVP, but any future task needing to store a file should go through this function so switching R2 → MinIO stays a config change.

- [ ] **Step 1: Write the failing test for the storage wrapper**

Create `tests/storage.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.fn().mockResolvedValue({})

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}))

beforeEach(() => {
  sendMock.mockClear()
  process.env.S3_ENDPOINT = 'http://localhost:9000'
  process.env.S3_REGION = 'auto'
  process.env.S3_BUCKET = 'love-site-photos'
  process.env.S3_ACCESS_KEY_ID = 'key'
  process.env.S3_SECRET_ACCESS_KEY = 'secret'
  process.env.S3_PUBLIC_BASE_URL = 'http://localhost:9000/love-site-photos'
})

describe('uploadPhoto', () => {
  it('uploads the buffer and returns a public URL under the photos/ prefix', async () => {
    const { uploadPhoto } = await import('@/lib/storage')
    const url = await uploadPhoto(Buffer.from('fake-image-data'), 'image/png')

    expect(url).toMatch(/^http:\/\/localhost:9000\/love-site-photos\/photos\/.+/)
    expect(sendMock).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/storage.test.ts`
Expected: FAIL — `Cannot find module '@/lib/storage'`

- [ ] **Step 3: Implement `src/lib/storage.ts`**

```ts
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'

function getS3Client() {
  return new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
  })
}

export async function uploadPhoto(fileBuffer: Buffer, contentType: string): Promise<string> {
  const key = `photos/${randomUUID()}`
  const client = getS3Client()

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  )

  return `${process.env.S3_PUBLIC_BASE_URL}/${key}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/storage.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Write the failing test for the upload route**

Create `tests/upload-route.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb } from './helpers/db'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/storage', () => ({ uploadPhoto: vi.fn().mockResolvedValue('http://example.com/photos/1') }))

import { getServerSession } from 'next-auth'
import { POST } from '@/app/api/upload/route'

afterEach(async () => {
  vi.clearAllMocks()
  await resetDb()
})

async function seedUserWithProfile() {
  const user = await prisma.user.create({ data: { email: 'alice@example.com', passwordHash: 'x' } })
  await prisma.profile.create({
    data: {
      userId: user.id,
      firstName: 'Alice',
      birthDate: new Date('2000-01-01'),
      gender: 'femme',
      city: 'Paris',
      country: 'France',
      bio: 'Bio',
      denomination: 'catholique',
      churchAttendance: 'regulierement',
      marriageVision: 'Famille unie',
      favoriteVerseOrValue: 'Philippiens 4:13',
    },
  })
  return user
}

function makeUploadRequest(file: File) {
  const formData = new FormData()
  formData.set('file', file)
  return new Request('http://localhost/api/upload', { method: 'POST', body: formData }) as never
}

describe('POST /api/upload', () => {
  it('rejects unauthenticated requests', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const file = new File([Buffer.from('data')], 'photo.png', { type: 'image/png' })
    const response = await POST(makeUploadRequest(file))
    expect(response.status).toBe(401)
  })

  it('adds the uploaded photo URL to the profile', async () => {
    const user = await seedUserWithProfile()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id } } as never)

    const file = new File([Buffer.from('data')], 'photo.png', { type: 'image/png' })
    const response = await POST(makeUploadRequest(file))

    expect(response.status).toBe(201)
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } })
    expect(profile?.photos).toEqual(['http://example.com/photos/1'])
  })

  it('rejects a disallowed file type', async () => {
    const user = await seedUserWithProfile()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id } } as never)

    const file = new File([Buffer.from('data')], 'doc.pdf', { type: 'application/pdf' })
    const response = await POST(makeUploadRequest(file))

    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- tests/upload-route.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/upload/route'`

- [ ] **Step 7: Implement `src/app/api/upload/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadPhoto } from '@/lib/storage'
import { prisma } from '@/lib/db'

const MAX_PHOTOS = 6
const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const userId = (session.user as { id: string }).id
  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'invalid_file_type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 })
  }

  const profile = await prisma.profile.findUnique({ where: { userId } })
  if (!profile) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  }
  if (profile.photos.length >= MAX_PHOTOS) {
    return NextResponse.json({ error: 'max_photos_reached' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const url = await uploadPhoto(buffer, file.type)

  const updated = await prisma.profile.update({
    where: { userId },
    data: { photos: { push: url } },
  })

  return NextResponse.json({ photos: updated.photos }, { status: 201 })
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- tests/upload-route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Wire a file input into the profile edit page**

Modify `src/app/profile/edit/page.tsx`: add `<input type="file" accept="image/png,image/jpeg,image/webp" />`, and on change build a `FormData`, `POST` it to `/api/upload`, then render the returned `photos` URLs as `<img>` thumbnails.

- [ ] **Step 10: Manual verification**

Set real R2 credentials in `.env` (or point `S3_ENDPOINT`/`S3_PUBLIC_BASE_URL` at a local MinIO if you have one running). Run `npm run dev`, upload a photo from `/profile/edit`, confirm the thumbnail renders and the file appears in the bucket.

- [ ] **Step 11: Commit**

```bash
git add src/lib/storage.ts src/app/api/upload src/app/profile/edit tests/storage.test.ts tests/upload-route.test.ts
git commit -m "feat: add S3-compatible photo upload"
```

---

## Task 7: Discovery feed

**Files:**
- Create: `src/lib/discovery.ts`
- Create: `src/app/api/discover/route.ts`
- Create: `src/app/discover/page.tsx`
- Test: `tests/discovery.test.ts`

**Interfaces:**
- Consumes: `authOptions` (Task 4), `prisma` (Task 2, including the `Block` table even though `blockUser` itself is written in Task 10)
- Produces: `getDiscoverableProfiles(userId: string, filters?: DiscoveryFilters): Promise<Profile[]>` — consumed by Task 10's cross-check test.

- [ ] **Step 1: Write the failing test**

Create `tests/discovery.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { getDiscoverableProfiles } from '@/lib/discovery'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

async function createUser(overrides: {
  email: string
  gender: 'homme' | 'femme'
  city?: string
  suspended?: boolean
}) {
  return prisma.user.create({
    data: {
      email: overrides.email,
      passwordHash: 'x',
      suspended: overrides.suspended ?? false,
      profile: {
        create: {
          firstName: overrides.email,
          birthDate: new Date('1995-01-01'),
          gender: overrides.gender,
          city: overrides.city ?? 'Paris',
          country: 'France',
          bio: 'Bio',
          denomination: 'catholique',
          churchAttendance: 'regulierement',
          marriageVision: 'Famille unie',
          favoriteVerseOrValue: 'Philippiens 4:13',
        },
      },
    },
  })
}

describe('getDiscoverableProfiles', () => {
  it('only returns profiles of the opposite gender', async () => {
    const me = await createUser({ email: 'me@example.com', gender: 'homme' })
    const her = await createUser({ email: 'her@example.com', gender: 'femme' })
    await createUser({ email: 'him@example.com', gender: 'homme' })

    const results = await getDiscoverableProfiles(me.id)

    expect(results.map((p) => p.userId)).toEqual([her.id])
  })

  it('excludes suspended users', async () => {
    const me = await createUser({ email: 'me@example.com', gender: 'homme' })
    await createUser({ email: 'suspended@example.com', gender: 'femme', suspended: true })

    const results = await getDiscoverableProfiles(me.id)

    expect(results).toHaveLength(0)
  })

  it('filters by city when provided', async () => {
    const me = await createUser({ email: 'me@example.com', gender: 'homme' })
    const parisienne = await createUser({ email: 'a@example.com', gender: 'femme', city: 'Paris' })
    await createUser({ email: 'b@example.com', gender: 'femme', city: 'Lyon' })

    const results = await getDiscoverableProfiles(me.id, { city: 'Paris' })

    expect(results.map((p) => p.userId)).toEqual([parisienne.id])
  })

  it('excludes users that have blocked or been blocked by the requester', async () => {
    const me = await createUser({ email: 'me@example.com', gender: 'homme' })
    const blocked = await createUser({ email: 'blocked@example.com', gender: 'femme' })
    await prisma.block.create({ data: { blockerId: me.id, blockedUserId: blocked.id } })

    const results = await getDiscoverableProfiles(me.id)

    expect(results).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/discovery.test.ts`
Expected: FAIL — `Cannot find module '@/lib/discovery'`

- [ ] **Step 3: Implement `src/lib/discovery.ts`**

```ts
import { prisma } from '@/lib/db'
import type { Denomination, Gender } from '@prisma/client'

export type DiscoveryFilters = {
  minAge?: number
  maxAge?: number
  city?: string
  country?: string
  denomination?: Denomination
}

function oppositeGender(gender: Gender): Gender {
  return gender === 'homme' ? 'femme' : 'homme'
}

export async function getDiscoverableProfiles(userId: string, filters: DiscoveryFilters = {}) {
  const me = await prisma.profile.findUnique({ where: { userId } })
  if (!me) return []

  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedUserId: userId }] },
  })
  const blockedIds = blocks.map((b) => (b.blockerId === userId ? b.blockedUserId : b.blockerId))

  const now = new Date()
  const birthDateFilter: { lte?: Date; gte?: Date } = {}
  if (filters.minAge !== undefined) {
    birthDateFilter.lte = new Date(now.getFullYear() - filters.minAge, now.getMonth(), now.getDate())
  }
  if (filters.maxAge !== undefined) {
    birthDateFilter.gte = new Date(now.getFullYear() - filters.maxAge - 1, now.getMonth(), now.getDate())
  }

  return prisma.profile.findMany({
    where: {
      userId: { notIn: [userId, ...blockedIds] },
      gender: oppositeGender(me.gender),
      user: { suspended: false },
      ...(filters.city ? { city: filters.city } : {}),
      ...(filters.country ? { country: filters.country } : {}),
      ...(filters.denomination ? { denomination: filters.denomination } : {}),
      ...(Object.keys(birthDateFilter).length ? { birthDate: birthDateFilter } : {}),
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/discovery.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Implement the API route**

Create `src/app/api/discover/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDiscoverableProfiles } from '@/lib/discovery'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const profiles = await getDiscoverableProfiles((session.user as { id: string }).id, {
    city: searchParams.get('city') ?? undefined,
    country: searchParams.get('country') ?? undefined,
    denomination: (searchParams.get('denomination') as never) ?? undefined,
    minAge: searchParams.get('minAge') ? Number(searchParams.get('minAge')) : undefined,
    maxAge: searchParams.get('maxAge') ? Number(searchParams.get('maxAge')) : undefined,
  })

  return NextResponse.json(profiles)
}
```

- [ ] **Step 6: Add the discover page**

Create `src/app/discover/page.tsx`: a client component that fetches `/api/discover` (optionally with query params from simple filter inputs for city/country/denomination), renders each profile's photo/firstName/city/bio, and a "J'aime" button per card that will call `/api/likes` (wired in Task 8).

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, create two opposite-gender accounts with completed profiles, log in as one, visit `/discover`, confirm the other profile appears and same-gender/self accounts don't.

- [ ] **Step 8: Commit**

```bash
git add src/lib/discovery.ts src/app/api/discover src/app/discover tests/discovery.test.ts
git commit -m "feat: add discovery feed enforcing opposite-gender matching and filters"
```

---

## Task 8: Likes & matching

**Files:**
- Create: `src/lib/likes.ts`
- Create: `src/app/api/likes/route.ts`
- Modify: `src/app/discover/page.tsx` (wire the "J'aime" button to `/api/likes`)
- Test: `tests/likes.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `authOptions` (Task 4)
- Produces: `likeUser(fromUserId: string, toUserId: string): Promise<{ matched: boolean; match?: Match }>` — consumed by Task 9 (messaging needs `Match` rows to exist).

- [ ] **Step 1: Write the failing test**

Create `tests/likes.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { likeUser } from '@/lib/likes'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

async function createUser(email: string) {
  return prisma.user.create({ data: { email, passwordHash: 'x' } })
}

describe('likeUser', () => {
  it('records a one-way like without creating a match', async () => {
    const alice = await createUser('alice@example.com')
    const bob = await createUser('bob@example.com')

    const result = await likeUser(alice.id, bob.id)

    expect(result.matched).toBe(false)
    expect(await prisma.match.count()).toBe(0)
  })

  it('creates a match when the like is mutual', async () => {
    const alice = await createUser('alice@example.com')
    const bob = await createUser('bob@example.com')

    await likeUser(alice.id, bob.id)
    const result = await likeUser(bob.id, alice.id)

    expect(result.matched).toBe(true)
    expect(await prisma.match.count()).toBe(1)
  })

  it('is idempotent when the same user likes twice', async () => {
    const alice = await createUser('alice@example.com')
    const bob = await createUser('bob@example.com')

    await likeUser(alice.id, bob.id)
    await likeUser(alice.id, bob.id)

    expect(await prisma.like.count()).toBe(1)
  })

  it('rejects liking yourself', async () => {
    const alice = await createUser('alice@example.com')
    await expect(likeUser(alice.id, alice.id)).rejects.toThrow('cannot_like_self')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/likes.test.ts`
Expected: FAIL — `Cannot find module '@/lib/likes'`

- [ ] **Step 3: Implement `src/lib/likes.ts`**

```ts
import { prisma } from '@/lib/db'

export async function likeUser(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) {
    throw new Error('cannot_like_self')
  }

  await prisma.like.upsert({
    where: { fromUserId_toUserId: { fromUserId, toUserId } },
    create: { fromUserId, toUserId },
    update: {},
  })

  const reciprocal = await prisma.like.findUnique({
    where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: fromUserId } },
  })

  if (!reciprocal) {
    return { matched: false as const }
  }

  const [userAId, userBId] = [fromUserId, toUserId].sort()

  const match = await prisma.match.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId },
    update: {},
  })

  return { matched: true as const, match }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/likes.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Implement the API route**

Create `src/app/api/likes/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { likeUser } from '@/lib/likes'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await request.json()
  if (typeof body?.toUserId !== 'string') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const result = await likeUser((session.user as { id: string }).id, body.toUserId)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
```

- [ ] **Step 6: Wire the "J'aime" button**

Modify `src/app/discover/page.tsx`: on click, `POST` `{ toUserId: profile.userId }` to `/api/likes`; if `matched` is `true` in the response, show a small "C'est un match !" confirmation.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, like each other's profile from two accounts, confirm the second like shows the "C'est un match !" message.

- [ ] **Step 8: Commit**

```bash
git add src/lib/likes.ts src/app/api/likes src/app/discover/page.tsx tests/likes.test.ts
git commit -m "feat: add mutual-like matching"
```

---

## Task 9: Messaging

**Files:**
- Create: `src/lib/messages.ts`
- Create: `src/app/api/matches/route.ts`
- Create: `src/app/api/matches/[matchId]/messages/route.ts`
- Create: `src/app/matches/page.tsx`
- Create: `src/app/matches/[matchId]/page.tsx`
- Test: `tests/messages.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `authOptions` (Task 4), `Match` rows produced by `likeUser` (Task 8)
- Produces: `sendMessage(matchId, senderId, content)`, `listMessages(matchId, requesterId)`, `listMatchesForUser(userId)` — not consumed by later tasks, but exported for the admin task's potential future use.

- [ ] **Step 1: Write the failing test**

Create `tests/messages.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { listMatchesForUser, listMessages, sendMessage } from '@/lib/messages'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

async function createMatch() {
  const alice = await prisma.user.create({ data: { email: 'alice@example.com', passwordHash: 'x' } })
  const bob = await prisma.user.create({ data: { email: 'bob@example.com', passwordHash: 'x' } })
  const [userAId, userBId] = [alice.id, bob.id].sort()
  const match = await prisma.match.create({ data: { userAId, userBId } })
  return { alice, bob, match }
}

describe('sendMessage', () => {
  it('lets a participant send a message', async () => {
    const { alice, match } = await createMatch()
    const message = await sendMessage(match.id, alice.id, 'Bonjour !')
    expect(message.content).toBe('Bonjour !')
  })

  it('rejects a non-participant', async () => {
    const { match } = await createMatch()
    const stranger = await prisma.user.create({ data: { email: 'carol@example.com', passwordHash: 'x' } })
    await expect(sendMessage(match.id, stranger.id, 'Salut')).rejects.toThrow('not_a_participant')
  })
})

describe('listMessages', () => {
  it('returns messages in chronological order', async () => {
    const { alice, bob, match } = await createMatch()
    await sendMessage(match.id, alice.id, 'Premier')
    await sendMessage(match.id, bob.id, 'Deuxième')

    const messages = await listMessages(match.id, alice.id)

    expect(messages.map((m) => m.content)).toEqual(['Premier', 'Deuxième'])
  })
})

describe('listMatchesForUser', () => {
  it('returns only matches involving the given user', async () => {
    const { alice, match } = await createMatch()
    const other = await prisma.user.create({ data: { email: 'dave@example.com', passwordHash: 'x' } })

    const matches = await listMatchesForUser(alice.id)

    expect(matches.map((m) => m.id)).toEqual([match.id])
    expect(matches.map((m) => m.id)).not.toContain(other.id)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/messages.test.ts`
Expected: FAIL — `Cannot find module '@/lib/messages'`

- [ ] **Step 3: Implement `src/lib/messages.ts`**

```ts
import { prisma } from '@/lib/db'

async function assertParticipant(matchId: string, userId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) throw new Error('match_not_found')
  if (match.userAId !== userId && match.userBId !== userId) {
    throw new Error('not_a_participant')
  }
  return match
}

export async function sendMessage(matchId: string, senderId: string, content: string) {
  await assertParticipant(matchId, senderId)
  return prisma.message.create({ data: { matchId, senderId, content } })
}

export async function listMessages(matchId: string, requesterId: string) {
  await assertParticipant(matchId, requesterId)
  return prisma.message.findMany({ where: { matchId }, orderBy: { sentAt: 'asc' } })
}

export async function listMatchesForUser(userId: string) {
  return prisma.match.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { include: { profile: true } },
      userB: { include: { profile: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/messages.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Implement the API routes**

Create `src/app/api/matches/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listMatchesForUser } from '@/lib/messages'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const matches = await listMatchesForUser((session.user as { id: string }).id)
  return NextResponse.json(matches)
}
```

Create `src/app/api/matches/[matchId]/messages/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listMessages, sendMessage } from '@/lib/messages'

export async function GET(_request: NextRequest, { params }: { params: { matchId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const messages = await listMessages(params.matchId, (session.user as { id: string }).id)
    return NextResponse.json(messages)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { matchId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await request.json()
  if (typeof body?.content !== 'string' || body.content.trim() === '') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const message = await sendMessage(params.matchId, (session.user as { id: string }).id, body.content)
    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 })
  }
}
```

- [ ] **Step 6: Add the matches list and conversation pages**

Create `src/app/matches/page.tsx`: fetch `/api/matches`, list each match's other participant (`firstName`, first photo), linking to `/matches/[matchId]`.

Create `src/app/matches/[matchId]/page.tsx`: fetch `/api/matches/[matchId]/messages` on mount and every few seconds via `setInterval` (polling, per the spec's "no real-time requirement"), render messages, and a form that `POST`s new ones to the same endpoint.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, produce a match between two accounts (Task 8), open `/matches`, click into the conversation, send messages from both accounts, confirm they appear after the next poll.

- [ ] **Step 8: Commit**

```bash
git add src/lib/messages.ts src/app/api/matches src/app/matches tests/messages.test.ts
git commit -m "feat: add basic messaging between matched users"
```

---

## Task 10: Reporting & blocking

**Files:**
- Create: `src/lib/safety.ts`
- Create: `src/app/api/reports/route.ts`
- Create: `src/app/api/blocks/route.ts`
- Modify: `src/app/discover/page.tsx`, `src/app/matches/[matchId]/page.tsx` (add "Signaler" / "Bloquer" actions)
- Test: `tests/safety.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `authOptions` (Task 4), `getDiscoverableProfiles` (Task 7, for the cross-check test)
- Produces: `createReport(reporterId, reportedUserId, category, reason)`, `blockUser(blockerId, blockedUserId)`

- [ ] **Step 1: Write the failing test**

Create `tests/safety.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { blockUser, createReport } from '@/lib/safety'
import { getDiscoverableProfiles } from '@/lib/discovery'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

async function createUser(email: string, gender: 'homme' | 'femme' = 'homme') {
  return prisma.user.create({
    data: {
      email,
      passwordHash: 'x',
      profile: {
        create: {
          firstName: email,
          birthDate: new Date('1995-01-01'),
          gender,
          city: 'Paris',
          country: 'France',
          bio: 'Bio',
          denomination: 'catholique',
          churchAttendance: 'regulierement',
          marriageVision: 'Famille unie',
          favoriteVerseOrValue: 'Philippiens 4:13',
        },
      },
    },
  })
}

describe('createReport', () => {
  it('records a report with pending status', async () => {
    const alice = await createUser('alice@example.com')
    const bob = await createUser('bob@example.com', 'femme')

    const report = await createReport(alice.id, bob.id, 'comportement_inapproprie', 'Message déplacé')

    expect(report.status).toBe('en_attente')
  })

  it('rejects self-reporting', async () => {
    const alice = await createUser('alice@example.com')
    await expect(createReport(alice.id, alice.id, 'autre', 'test')).rejects.toThrow('cannot_report_self')
  })
})

describe('blockUser', () => {
  it('is idempotent', async () => {
    const alice = await createUser('alice@example.com')
    const bob = await createUser('bob@example.com', 'femme')

    await blockUser(alice.id, bob.id)
    await blockUser(alice.id, bob.id)

    expect(await prisma.block.count()).toBe(1)
  })

  it('removes the blocked user from discovery immediately', async () => {
    const alice = await createUser('alice@example.com')
    const bob = await createUser('bob@example.com', 'femme')

    expect(await getDiscoverableProfiles(alice.id)).toHaveLength(1)
    await blockUser(alice.id, bob.id)
    expect(await getDiscoverableProfiles(alice.id)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/safety.test.ts`
Expected: FAIL — `Cannot find module '@/lib/safety'`

- [ ] **Step 3: Implement `src/lib/safety.ts`**

```ts
import { prisma } from '@/lib/db'
import type { ReportCategory } from '@prisma/client'

export async function createReport(
  reporterId: string,
  reportedUserId: string,
  category: ReportCategory,
  reason: string
) {
  if (reporterId === reportedUserId) {
    throw new Error('cannot_report_self')
  }

  return prisma.report.create({ data: { reporterId, reportedUserId, category, reason } })
}

export async function blockUser(blockerId: string, blockedUserId: string) {
  if (blockerId === blockedUserId) {
    throw new Error('cannot_block_self')
  }

  return prisma.block.upsert({
    where: { blockerId_blockedUserId: { blockerId, blockedUserId } },
    create: { blockerId, blockedUserId },
    update: {},
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/safety.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Implement the API routes**

Create `src/app/api/reports/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createReport } from '@/lib/safety'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await request.json()
  if (typeof body?.reportedUserId !== 'string' || typeof body?.category !== 'string' || typeof body?.reason !== 'string') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const report = await createReport(
      (session.user as { id: string }).id,
      body.reportedUserId,
      body.category,
      body.reason
    )
    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
```

Create `src/app/api/blocks/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { blockUser } from '@/lib/safety'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await request.json()
  if (typeof body?.blockedUserId !== 'string') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const block = await blockUser((session.user as { id: string }).id, body.blockedUserId)
    return NextResponse.json(block, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
```

- [ ] **Step 6: Wire up the UI actions**

Modify `src/app/discover/page.tsx` and `src/app/matches/[matchId]/page.tsx`: add "Signaler" (opens a small form for `category` + `reason`, posts to `/api/reports`) and "Bloquer" (posts `{ blockedUserId }` to `/api/blocks`, then removes that profile/conversation from the current view) actions.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, from `/discover` block a profile, confirm it disappears immediately from the feed (reload to be sure it doesn't come back).

- [ ] **Step 8: Commit**

```bash
git add src/lib/safety.ts src/app/api/reports src/app/api/blocks src/app/discover/page.tsx "src/app/matches/[matchId]/page.tsx" tests/safety.test.ts
git commit -m "feat: add reporting and blocking"
```

---

## Task 11: Admin report management

**Files:**
- Create: `src/lib/admin.ts`
- Create: `src/middleware.ts`
- Create: `src/app/api/admin/reports/route.ts`
- Create: `src/app/api/admin/reports/[id]/route.ts`
- Create: `src/app/admin/page.tsx`
- Create: `prisma/seed.ts`
- Test: `tests/admin.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `authOptions`/JWT shape (Task 4)
- Produces: `listReports(status?)`, `updateReportStatus(reportId, status)`, `suspendUser(userId)` — terminal task, nothing downstream consumes these.

- [ ] **Step 1: Write the failing test**

Create `tests/admin.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { listReports, suspendUser, updateReportStatus } from '@/lib/admin'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

async function seedReport() {
  const reporter = await prisma.user.create({ data: { email: 'reporter@example.com', passwordHash: 'x' } })
  const reported = await prisma.user.create({ data: { email: 'reported@example.com', passwordHash: 'x' } })
  const report = await prisma.report.create({
    data: {
      reporterId: reporter.id,
      reportedUserId: reported.id,
      category: 'comportement_inapproprie',
      reason: 'Message déplacé',
    },
  })
  return { reporter, reported, report }
}

describe('listReports', () => {
  it('filters by status when provided', async () => {
    const { report } = await seedReport()
    await updateReportStatus(report.id, 'traite')
    await seedReport()

    const pending = await listReports('en_attente')
    const treated = await listReports('traite')

    expect(pending).toHaveLength(1)
    expect(treated).toHaveLength(1)
  })
})

describe('suspendUser', () => {
  it('sets the suspended flag', async () => {
    const { reported } = await seedReport()

    await suspendUser(reported.id)

    const user = await prisma.user.findUnique({ where: { id: reported.id } })
    expect(user?.suspended).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/admin.test.ts`
Expected: FAIL — `Cannot find module '@/lib/admin'`

- [ ] **Step 3: Implement `src/lib/admin.ts`**

```ts
import { prisma } from '@/lib/db'
import type { ReportStatus } from '@prisma/client'

export async function listReports(status?: ReportStatus) {
  return prisma.report.findMany({
    where: status ? { status } : undefined,
    include: { reporter: true, reportedUser: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateReportStatus(reportId: string, status: ReportStatus) {
  return prisma.report.update({ where: { id: reportId }, data: { status } })
}

export async function suspendUser(userId: string) {
  return prisma.user.update({ where: { id: userId }, data: { suspended: true } })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/admin.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Protect `/admin` and `/api/admin` with middleware**

Create `src/middleware.ts`:
```ts
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  if (!token || token.role !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
```

- [ ] **Step 6: Implement the admin API routes**

Create `src/app/api/admin/reports/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { listReports } from '@/lib/admin'
import type { ReportStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  const status = new URL(request.url).searchParams.get('status') as ReportStatus | null
  const reports = await listReports(status ?? undefined)
  return NextResponse.json(reports)
}
```

Create `src/app/api/admin/reports/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { suspendUser, updateReportStatus } from '@/lib/admin'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  if (body.action === 'traite' || body.action === 'ignore') {
    const report = await updateReportStatus(params.id, body.action)
    return NextResponse.json(report)
  }

  if (body.action === 'suspend') {
    const reportRecord = await updateReportStatus(params.id, 'traite')
    const { prisma } = await import('@/lib/db')
    const fullReport = await prisma.report.findUnique({ where: { id: params.id } })
    if (fullReport) await suspendUser(fullReport.reportedUserId)
    return NextResponse.json(reportRecord)
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
}
```

- [ ] **Step 7: Add the admin page**

Create `src/app/admin/page.tsx`: fetch `/api/admin/reports`, render a table (reporter email, reported user's `firstName`, category, reason, status, date), with buttons per row calling `PATCH /api/admin/reports/[id]` with `{ action: 'traite' | 'ignore' | 'suspend' }` and refetching the list after each action.

- [ ] **Step 8: Add the admin seed script**

Create `prisma/seed.ts`:
```ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set')
  }

  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, role: 'admin' },
    update: { role: 'admin' },
  })
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
```

Add to `package.json` `scripts`: `"db:seed": "tsx prisma/seed.ts"`.

Run: `npm run db:seed`
Expected: a user with the `.env`'s `ADMIN_EMAIL`/`ADMIN_PASSWORD` exists with `role = admin` (check via `npx prisma studio`).

- [ ] **Step 9: Manual verification**

Run: `npm run dev`. Log in as a non-admin account, try to visit `/admin`, confirm you're redirected to `/login`. Log in with the seeded admin credentials, visit `/admin`, file a report from another account first (Task 10), then confirm it appears and that "Suspendre" flips the reported user's `suspended` flag (verify that user can no longer log in, per Task 4's `authorizeCredentials`).

- [ ] **Step 10: Commit**

```bash
git add src/lib/admin.ts src/middleware.ts src/app/api/admin src/app/admin prisma/seed.ts package.json tests/admin.test.ts
git commit -m "feat: add admin report management and first-admin seed script"
```
