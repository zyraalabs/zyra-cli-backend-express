export const NEXTJS_AGENT_STACK = `## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (New York) · pnpm.

Verify with \`pnpm build\`. For a faster type-only check, \`pnpm exec tsc --noEmit\`.

## Files that must exist in every app

Check each of these with list_dir or read_file, and create any that is missing. Several fail silently — the build passes and the defect ships.

- **src/app/layout.tsx** — root layout. Omit it and Next.js silently generates a default: no Google Font, no \`--font-sans\` variable, no metadata, and \`font-sans\` on \`<body>\` resolves to nothing. The build still passes. The most commonly missed file.
- **src/app/page.tsx** — without it the app 404s at /.
- **src/app/globals.css** — required by layout.tsx.
- **postcss.config.mjs** — without it \`@import "tailwindcss"\` never compiles, every utility class is inert, and \`next build\` fails.
- **pnpm-workspace.yaml** — without it \`pnpm install\` fails.
- **src/lib/utils.ts** — every shadcn/ui component imports \`cn\` from here.
- **.env.example** and **.env.local** — identical placeholder content.
- **zyraa.md** and **.zyraa/index.md** — read by future sessions. Formats below.

When the app has API routes, also required:
- **src/lib/api-response.ts**, **src/lib/db.ts** (MongoDB only), **src/lib/axios.ts**.

When the app has auth with protected pages, also required:
- **src/proxy.ts** and **src/lib/auth.ts**.

## Build-blocking config

**postcss.config.mjs**
\`\`\`js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
\`\`\`

**pnpm-workspace.yaml** — exactly these three lines:
\`\`\`yaml
allowBuilds:
  sharp: true
  unrs-resolver: true
\`\`\`

\`sharp\` and \`unrs-resolver\` ship native binaries and must run install scripts. Current pnpm blocks unapproved build scripts and fails with \`ERR_PNPM_IGNORED_BUILDS\`. Only \`allowBuilds\` with literal \`true\` values approves them. Never write placeholder text such as "set this to true or false" — pnpm writes that stub itself when a script is unapproved and it is not a valid approval. Do not use the \`onlyBuiltDependencies\` list form; it does not approve the scripts. Do not add a \`"pnpm"\` key to package.json — pnpm reads \`pnpm-workspace.yaml\` instead.

**package.json** — use these exact versions:
\`\`\`json
{
  "name": "<short kebab-case name derived from the request>",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "biome check",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@radix-ui/react-avatar": "^1.1.1",
    "@radix-ui/react-checkbox": "^1.1.2",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-label": "^2.1.1",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-switch": "^1.1.1",
    "@radix-ui/react-tabs": "^1.1.1",
    "axios": "^1.7.9",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.563.0",
    "next": "16.1.6",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "tailwind-merge": "^3.4.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.2.0",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "tw-animate-css": "^1.4.0",
    "typescript": "^5"
  }
}
\`\`\`

Extra dependencies by use case — never invent version numbers; use \`"latest"\` for anything unlisted:
MongoDB \`"mongoose": "^8.8.4"\` · validation \`"zod": "^3.23.8"\`, \`"react-hook-form": "^7.53.2"\` · dates \`"date-fns": "^4.1.0"\` · NextAuth \`"next-auth": "4.24.11"\` (exact, no caret) · JWT \`"jsonwebtoken": "^9.0.2"\` + \`"@types/jsonwebtoken": "^9.0.7"\` · hashing \`"bcryptjs": "^2.4.3"\` + \`"@types/bcryptjs": "^2.4.6"\` · Stripe \`"stripe": "^17.7.0"\`, \`"@stripe/stripe-js": "^5.5.0"\` · Razorpay \`"razorpay": "^2.9.6"\` · email \`"nodemailer": "^6.9.16"\` + \`"@types/nodemailer": "^6.4.17"\` · charts \`"recharts": "^2.15.0"\` · motion \`"framer-motion": "^11.18.2"\`.

Put every dependency in package.json before running \`pnpm install\`. Adding a package mid-build means installing again.

**tsconfig.json** — exactly this. \`moduleResolution\` must be \`"bundler"\` and \`paths\` must include \`"@/*"\`:
\`\`\`json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules"]
}
\`\`\`

Never write \`"incremental": true\` yourself and never add \`"tsBuildInfoFile"\`. A \`.tsbuildinfo\` cache lets a local build skip re-checking unchanged files while Vercel always builds clean and catches what the cached build skipped. Next.js 16 appends \`"incremental": true\` itself on first build — that is expected, leave it.

**next.config.ts**
\`\`\`typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
\`\`\`

**biome.json**
\`\`\`json
{
  "$schema": "https://biomejs.dev/schemas/2.2.0/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": {
    "ignoreUnknown": true,
    "includes": ["**", "!node_modules", "!.next", "!dist", "!build"]
  },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": { "noUnusedImports": "error", "noUnusedVariables": "error" },
      "suspicious": { "noUnknownAtRules": "off" }
    },
    "domains": { "next": "recommended", "react": "recommended" }
  }
}
\`\`\`

**components.json**
\`\`\`json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
\`\`\`

**src/lib/utils.ts**
\`\`\`typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
\`\`\`

## Project structure

\`\`\`
src/app/            layout.tsx, page.tsx, globals.css, api/, [routes]/
src/components/     ui/ (shadcn) and custom components
src/lib/            utils.ts, axios.ts, db.ts, auth.ts, api-response.ts
src/models/         Mongoose models
src/types/          index.ts
public/
.zyraa/index.md
\`\`\`

## Tailwind CSS v4

**src/app/globals.css** — both \`@import\` lines are mandatory and must come first:
\`\`\`css
@import "tailwindcss";
@import "tw-animate-css";

@layer base {
  body {
    font-family: var(--font-sans);
  }
}
\`\`\`

- Never use \`@apply\` — it does not work with custom class names in v4 and throws CssSyntaxError.
- Never define custom utility classes — v4 will not generate them.
- Define the palette with \`@theme\`; that is the correct v4 mechanism.
- \`@keyframes\` are allowed. Reference them from JSX with an inline style or an \`animate-[...]\` arbitrary value.
- shadcn components reference tokens like \`bg-card\` and \`text-muted-foreground\`. Those names are undefined unless you define them in \`@theme\`, or replace them with concrete classes. Never ship an undefined token.

## Visual design — make it distinctive

The most common failure is a competent app that looks like every other app: white card on gray background, blue primary button, uniform slate text. A user should be able to tell two Zyraa apps apart at a glance.

Commit to an aesthetic before writing markup, derived from the product's domain. A task manager for developers, a boutique hotel booking site, and a children's reading tracker should share no visual DNA. Decide each of these deliberately, then apply consistently:

- **Palette** — a real accent hue that suits the domain, not default blue. Define once in \`@theme\`. Neutrals may be warm, cool, or near-black; choose to match the accent rather than defaulting to gray.
- **Typography** — pair fonts with intent. Vary weight and size decisively; a 600-weight 3xl heading above 15px muted body reads designed, uniform 16px does not.
- **Shape and depth** — radius, border, and shadow are a signature. Sharp and flat, softly rounded with generous shadow, and heavy-bordered shadowless are three different products.
- **Space and density** — editorial layouts breathe, dashboards are dense. Match the domain.
- **One signature element** — a gradient, texture, asymmetric hero, or unexpected accent placement. One thing memorably its own.

\`\`\`css
@theme {
  --color-brand: oklch(0.62 0.19 28);
  --color-brand-soft: oklch(0.96 0.03 28);
  --color-ink: oklch(0.22 0.02 60);
  --color-ink-muted: oklch(0.55 0.02 60);
  --color-surface: oklch(0.99 0.005 80);
}
\`\`\`

Those values demonstrate the mechanism, not a house style. Support dark mode via \`dark:\` variants and give every token a sensible dark counterpart. Never ship an unreadable contrast pairing.

## Typography and fonts

Always use \`variable\` (not \`className\`) so \`var(--font-sans)\` resolves in globals.css:
\`\`\`typescript
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
\`\`\`

\`inter.className\` on \`<body>\` applies the font but leaves \`var(--font-sans)\` undefined, so the globals.css body rule resolves to nothing. Choose fonts to fit the product: modern sans for SaaS, serif for editorial, mono for developer tools.

Scale: H1 \`text-4xl font-bold tracking-tight\` · H2 \`text-2xl font-semibold\` · H3 \`text-lg font-semibold\` · body \`text-base leading-relaxed\` · caption \`text-sm text-gray-500\`.

## HTTP client

Always generate **src/lib/axios.ts** — one shared instance imported by every client component.

Cookie auth:
\`\`\`typescript
import axios from "axios";

const api = axios.create({ withCredentials: true });

export default api;
\`\`\`

localStorage auth:
\`\`\`typescript
import axios from "axios";

const api = axios.create();

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

export default api;
\`\`\`

Every \`"use client"\` component making API calls imports \`api\` from \`@/lib/axios\` — never native \`fetch\`. One instance per app. Server Components and API routes calling external services use native \`fetch\` with cache options.

## API routes

**src/lib/api-response.ts**
\`\`\`typescript
import { NextResponse } from "next/server";

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}
\`\`\`

**src/lib/db.ts** — cached MongoDB connection:
\`\`\`typescript
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) throw new Error("MONGODB_URI environment variable is not defined");

type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = global as typeof globalThis & { _mongooseCache?: MongooseCache };
if (!g._mongooseCache) g._mongooseCache = { conn: null, promise: null };
const cached = g._mongooseCache;

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) cached.promise = mongoose.connect(MONGODB_URI).then((m) => m);
  cached.conn = await cached.promise;
  return cached.conn;
}
\`\`\`

Every route follows this shape:
\`\`\`typescript
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  url: z.string().url("Must be a valid URL"),
});

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.errors[0].message, 400);
    return successResponse(result, 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Server error");
  }
}
\`\`\`

Rules: always use \`successResponse\`/\`errorResponse\`, never \`NextResponse.json()\` directly. Always wrap the handler in try/catch. Always validate the body with Zod before touching the database. Never write \`process.env.JWT_SECRET || "fallback"\` — use \`process.env.JWT_SECRET!\` and let the throw be explicit; a hardcoded fallback secret is a critical vulnerability that runs silently in production.

Mongoose typing:
\`\`\`typescript
const doc = await Model.findById(id).lean<IModel>();

export default mongoose.models.Recipe as mongoose.Model<IRecipe> ||
  mongoose.model<IRecipe>("Recipe", RecipeSchema);
\`\`\`
Never \`lean<FlattenMaps<IModel>>()\` — FlattenMaps strips subdocument arrays and breaks nested field access. Cast the \`mongoose.models.X\` fallback explicitly so the type is \`Model<IRecipe>\` throughout, not \`Model<any>\`.

## Auth

Where the token lives determines what can read it. Choose one strategy and apply it across the whole app.

**Cookie-based** — required when pages are protected server-side. Login sets an httpOnly cookie:
\`\`\`typescript
const response = NextResponse.json(successResponse({ user }));
response.cookies.set("token", jwt, {
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
});
return response;
\`\`\`

**src/proxy.ts** — the filename must be \`proxy.ts\`, not \`middleware.ts\`, and the export must be named \`proxy\`, not \`middleware\`. Both changed in Next.js 16; either one wrong is a hard build error.
\`\`\`typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const protectedRoutes = ["/dashboard", "/profile"];

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get("token")?.value;
  if (!token) return NextResponse.redirect(new URL("/auth/login", req.url));

  const payload = verifyToken(token);
  if (!payload) return NextResponse.redirect(new URL("/auth/login", req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
\`\`\`

**localStorage-based** — simpler, client-side protection only. Store with \`localStorage.setItem("token", jwt)\`; the axios interceptor attaches it. Guard pages in a layout with \`useEffect\`.

**Never mix the two.** If the token is in localStorage and \`proxy.ts\` checks \`request.headers.get("authorization")\`, it always fails — browsers never attach custom Authorization headers to page navigation, only explicit fetch/axios calls. Middleware can read cookies and standard browser headers; it cannot read localStorage, sessionStorage, or custom navigation headers. For API-route-level auth both strategies work: cookies via \`request.cookies.get("token")\`, localStorage via \`request.headers.get("authorization")\`.

## Completeness

Build in this order so nothing references something that does not exist yet:

1. package.json and config files
2. src/lib/ utilities
3. src/models/
4. all src/app/api/ routes
5. src/proxy.ts
6. pages and layouts
7. components

Never write a page that calls \`/api/x\` without creating \`src/app/api/x/route.ts\`. Never add a \`<Link href="/x">\` or \`router.push("/x")\` without creating \`src/app/x/page.tsx\`. Never import \`@/components/y\` without creating it — this is the most common Vercel failure, because the local dev server compiles lazily and only builds pages you visit, while Vercel compiles every page.

Before writing a component's interface, find every place it is used and collect every prop passed. A prop used at a call site but missing from the interface is a build failure. Write the interface last. Patterns needing specific support: \`asChild\` needs \`Slot\` from \`@radix-ui/react-slot\` and the \`Comp = asChild ? Slot : "button"\` pattern; \`open\`/\`onOpenChange\` on a modal must be accepted as controlled props; \`value\`/\`onChange\` on a custom input wrapper must be declared and forwarded.

If a public shareable page is part of the product — profiles, portfolios, storefronts, bio pages — generate \`src/app/[username]/page.tsx\` (or \`[slug]\`/\`[handle]\`). That page *is* the product. It reads the owner's data without auth, and anonymous visitor events must never require a \`userId\`.

Every feature must work end to end: analytics means a tracking endpoint plus charts on real data; themes means a selector plus persistence plus application; an admin dashboard means real queries, not placeholder tables. Never show a nav link, heading, or stat card without the feature behind it. Delete a user and their content and analytics go too — never leave orphaned documents.

## Interactivity

No dead UI. Every button has an \`onClick\` that does something. Every form submits and produces a visible result. Modals open and close, tabs switch content, toggles reflect state.

Delete actions confirm first, never delete on a single click. Every mutation disables its trigger while in flight, shows errors as rendered text rather than \`console.log\`, and updates local state on success without a reload.

Every page that loads data renders three states: loading (spinner or skeleton), empty (icon, heading, description, CTA), and error (visible message plus retry). Never fail silently.

\`\`\`tsx
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState("");

async function handleDelete(id: string) {
  if (!confirm("Delete this? This cannot be undone.")) return;
  setIsLoading(true);
  setError("");
  try {
    await api.delete(\`/api/items/\${id}\`);
    setItems((prev) => prev.filter((i) => i._id !== id));
  } catch (err) {
    setError(err instanceof Error ? err.message : "Delete failed. Please try again.");
  } finally {
    setIsLoading(false);
  }
}
\`\`\`

With no backend, use \`useState\` for data, persist to \`localStorage\` where sensible, hydrate in \`useEffect\`, and clear inputs after submit.

## UI patterns

The quality bar is Vercel, Linear, Resend, Notion — not a tutorial template.

**Spacing** is the clearest signal of quality. Page \`px-6 py-8\` or \`px-8 py-10\`. Cards \`p-6\` minimum, \`p-8\` for hero content — never \`p-4\` or less. Between sections \`gap-8\` or \`mb-12\`, never \`gap-3\`. Form fields \`space-y-5\`. Sidebar items \`px-3 py-2\` with \`gap-3\`.

**Sidebar** (dashboard apps): user profile block at top with avatar initials fallback, name bold, email smaller below. Active nav state via \`usePathname()\`, ghost for inactive, icon plus label on every item with \`h-4 w-4 shrink-0\`. Divider and logout at the bottom.

**Landing pages** convert. Every section answers one of: what is this (hero with outcome-stating H1, subheadline, two CTAs side by side, visual below), why care (features as alternating two-column rows with a visual one side and benefit bullets the other — never a three-icon grid of generic descriptions; plus social proof), what next (CTA section with contrasting background, then footer with logo, three or four columns, copyright). Sticky navbar: logo left, links center, signup right. The H1 states an outcome — "One link. Your entire world." not "Manage your links in one place".

**Auth pages**: \`min-h-screen flex items-center justify-center\` on the page, card \`rounded-2xl shadow-xl border p-8 w-full max-w-md\`. Logo and product name at the top. The password field must have a show/hide eye toggle. "Forgot password?" beside the password label. Terms checkbox on signup. \`useSearchParams()\` must live in a child component wrapped in \`<Suspense>\` — using it directly in a page component fails the production build.

**Stat cards**: label and accent-tinted icon on one row, large bold value below, trend line under that.

**Empty states** are never one line: icon in a tinted circle, semibold heading, short description, action button.

**Tables**: row hover tint, row actions revealed with \`group\` plus \`opacity-0 group-hover:opacity-100\`.

**Forms**: inputs \`h-11\` preferred and \`h-10\` minimum, with a visible focus ring. Labels \`block text-sm font-medium mb-1.5\`. Errors \`text-sm text-red-600 mt-1\`. Multi-line inputs are always auto-growing textareas.

**Loading**: skeletons with \`animate-pulse\` for content-heavy pages. Buttons replace their label with a spinning \`Loader2\`, never the text "Loading...".

**Dialogs**: generate \`src/components/ui/dialog.tsx\` whenever using \`@radix-ui/react-dialog\`. Confirm-delete uses the destructive variant, never primary. Overlay \`bg-black/60 backdrop-blur-sm\`.

**Mobile**: grids go \`grid-cols-1 md:grid-cols-2 lg:grid-cols-3\`. Sidebar hidden behind a hamburger below \`lg:\`. Touch targets \`min-h-[44px]\`.

**Derive, never hardcode** anything that changes: copyright year is \`{new Date().getFullYear()}\`, timestamps come from data, thresholds are named constants, repeated labels come from a lookup map.

## Code quality

**No \`any\`, ever.** Implicit \`any\` is a build error under \`strict\`, and explicit \`any\` is a lint error. Type array callback parameters. In catch blocks use \`err instanceof Error ? err.message : "Server error"\`. If a third-party type gap makes \`any\` unavoidable, disable the rule on that single line only.

\`"use client"\` must be the very first line, before imports, in any file using hooks, router hooks, or event handlers. Forgetting it is a build error. Otherwise prefer Server Components.

Guard against null before calling string methods — use \`?.\` and \`??\`. Validate anything parsed from localStorage; older saved data may be missing fields.

## zyraa.md

Write this at the project root. Future sessions read it for context so they never re-ask settled questions. Replace every placeholder with real values and omit lines that do not apply.

\`\`\`markdown
# {Project Name}

> {One sentence: what the app does and who it is for.}

## Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** MongoDB (Mongoose)
- **Auth:** Cookie-based JWT (httpOnly, proxy-protected routes)
- **Styling:** Tailwind CSS v4 + shadcn/ui (New York style)

## Features
- {One line per feature, from the user's perspective}

## Env Variables
| Variable | Purpose |
|---|---|
| \`MONGODB_URI\` | MongoDB connection string |

## Architecture
- API routes live in \`src/app/api/\`
- MongoDB connection cached in \`src/lib/db.ts\`
- Shared axios instance in \`src/lib/axios.ts\`
\`\`\`

## .zyraa/index.md

Write this too. It tells future sessions which files to read. \`## File Index\` must be the last section — it is split on that header to preserve the summary above it.

\`\`\`markdown
# Project: project-name

## What it does
One to two sentences: what the product is and who uses it.

## Stack
Next.js 16 · MongoDB · Cookie JWT auth · Recharts · Zod

## Data models
- User: email, password (hashed), username, theme, isAdmin
- Link: userId, title, url, order, clicks

## Auth
Cookie-based JWT: login sets an httpOnly cookie, proxy reads
request.cookies.get("token"), protects /dashboard and /admin.

## Key flows
1. Public profile: GET /[username] → fetch links → click → POST /api/links/[id]/click
2. Dashboard: proxy-protected → link CRUD → analytics charts

## File Index
- package.json — Project dependencies and scripts
- src/app/layout.tsx — Root layout with Inter font variable
\`\`\`

Descriptions run five to ten words. List every file except \`.env*\` and \`biome.json\`. Omit the Auth section when there is no auth.

## Environment variables

Write **.env.example** and **.env.local** with identical content. Scan every \`process.env.X\` reference across the project and list all of them, \`NEXT_PUBLIC_\` included. Use the \`your_xxx_here\` placeholder form — the CLI detects that pattern to prompt the user. Never leave either file empty or comment-only.

\`\`\`
MONGODB_URI=your_mongodb_connection_string_here
JWT_SECRET=your_jwt_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
\`\`\`

## Before you finish

Run \`pnpm build\`. It must pass.

Then verify, using tools rather than memory:
- \`list_dir\` the project and confirm every file in "Files that must exist" is present.
- Confirm every \`@/components/\` import resolves to a file that exists.
- Confirm every route you link to has a \`page.tsx\`, and every endpoint you call has a \`route.ts\`.
- Run \`pnpm lint\` and fix every unused import and variable it reports.`;
