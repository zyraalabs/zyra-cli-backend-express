export const VITE_REACT_AGENT_STACK = `## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · pnpm.

There is no server runtime. All data comes from client-side fetches, local state, or localStorage.

Verify with \`pnpm build\`. For a faster type-only check, \`pnpm exec tsc --noEmit\`.

## Files that must exist

- **index.html** — the Vite entry document.
- **src/main.tsx** — mounts the app.
- **src/App.tsx** — root component.
- **src/index.css** — must begin with \`@import "tailwindcss";\`.
- **vite.config.ts** — needs the Tailwind plugin and the \`@\` alias.
- **src/lib/utils.ts** — every shadcn component imports \`cn\` from here.
- **.env.example** and **.env.local** — identical placeholder content, \`VITE_\` prefixed.

## Project structure

\`\`\`
src/components/     ui/ (shadcn) and custom components
src/lib/            utils.ts
src/hooks/
src/types/          index.ts
src/App.tsx, src/main.tsx, src/index.css
public/
index.html
\`\`\`

## Build-blocking config

**vite.config.ts** — the Tailwind plugin and the alias are both required. Without the alias every \`@/\` import fails to resolve.
\`\`\`typescript
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
\`\`\`

\`@types/node\` must be in devDependencies for \`path\` to typecheck.

**tsconfig.json** — the alias must be declared here too, not only in Vite:
\`\`\`json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
\`\`\`

**tsconfig.app.json**:
\`\`\`json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
\`\`\`

\`noUnusedLocals\` and \`noUnusedParameters\` are on, so an unused import or variable is a hard build error here, not a warning. Keep the code clean as you go.

**src/lib/utils.ts**
\`\`\`typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
\`\`\`

## Tailwind CSS v4

**src/index.css** begins with the import, and the palette is declared with \`@theme\`:
\`\`\`css
@import "tailwindcss";

@theme {
  --color-brand: oklch(0.62 0.19 28);
  --color-ink: oklch(0.22 0.02 60);
  --color-ink-muted: oklch(0.55 0.02 60);
  --color-surface: oklch(0.99 0.005 80);
}
\`\`\`

- Never use \`@apply\` — it throws CssSyntaxError with custom class names in v4.
- Never define custom utility classes — v4 will not generate them.
- shadcn components reference tokens such as \`bg-card\` and \`text-muted-foreground\`. Define them in \`@theme\` or replace them with concrete classes. Never ship an undefined token.

## Environment variables

Vite only exposes variables prefixed \`VITE_\`, and they are read as \`import.meta.env.VITE_X\` — never \`process.env\`. Write \`.env.example\` and \`.env.local\` with identical \`your_xxx_here\` placeholders.

\`\`\`
VITE_API_URL=your_api_url_here
\`\`\`

Because there is no server, anything in a \`VITE_\` variable ships to the browser. Never put a secret in one.

## Routing

If the app has more than one screen, add \`react-router-dom\` to dependencies and define routes in \`App.tsx\`. Every link target must have a component that exists. There is no file-based routing here — routes only exist where you declare them.

## Data

No backend. Use \`useState\` for in-memory data, persist to \`localStorage\` where it makes sense, and hydrate in \`useEffect\`. Validate anything parsed from localStorage — older saved data may be missing fields, so provide defaults.

If the app calls an external API, use \`fetch\` or axios from a single shared module in \`src/lib/\`, and handle loading and error states at every call site.

## Visual design — make it distinctive

The most common failure is a competent app that looks like every other app: white card on gray background, blue primary button, uniform slate text. A user should be able to tell two Zyraa apps apart at a glance.

Commit to an aesthetic before writing markup, derived from the product's domain. Decide each of these deliberately, then apply consistently:

- **Palette** — a real accent hue suiting the domain, not default blue. Define once in \`@theme\`.
- **Typography** — pair fonts with intent; vary weight and size decisively.
- **Shape and depth** — radius, border, and shadow are a signature.
- **Space and density** — editorial layouts breathe, dashboards are dense.
- **One signature element** — a gradient, texture, or unexpected accent placement.

Support dark mode with \`dark:\` variants and give every token a dark counterpart.

Scale: H1 \`text-4xl font-bold tracking-tight\` · H2 \`text-2xl font-semibold\` · H3 \`text-lg font-semibold\` · body \`text-base leading-relaxed\` · caption \`text-sm\`.

## UI patterns

The quality bar is Vercel, Linear, Resend, Notion — not a tutorial template.

**Spacing** is the clearest signal of quality. Page \`px-6 py-8\`. Cards \`p-6\` minimum, never \`p-4\` or less. Between sections \`gap-8\`, never \`gap-3\`. Form fields \`space-y-5\`.

**Empty states** are never one line: icon in a tinted circle, semibold heading, short description, action button.

**Forms**: inputs \`h-11\` preferred, visible focus ring, labels \`block text-sm font-medium mb-1.5\`, errors \`text-sm text-red-600 mt-1\`. Multi-line inputs are auto-growing textareas.

**Loading**: skeletons with \`animate-pulse\`; buttons swap their label for a spinning \`Loader2\`, never the text "Loading...".

**Mobile**: grids \`grid-cols-1 md:grid-cols-2 lg:grid-cols-3\`, touch targets \`min-h-[44px]\`.

**Derive, never hardcode** anything that changes: copyright year is \`{new Date().getFullYear()}\`, thresholds are named constants, repeated labels come from a lookup map.

## Interactivity

No dead UI. Every button has an \`onClick\` that does something. Every form submits and produces a visible result. Modals open and close, tabs switch content, toggles reflect state.

Delete actions confirm first. Every async action disables its trigger while running and shows errors as rendered text, never \`console.log\`. Every data view renders loading, empty, and error states.

## Code quality

**No \`any\`, ever.** Implicit \`any\` is a build error under \`strict\`. Type array callback parameters. In catch blocks use \`err instanceof Error ? err.message : "Something went wrong"\`.

Guard against null before calling string methods — use \`?.\` and \`??\`.

## Before you finish

Run \`pnpm build\`. It must pass, and with \`noUnusedLocals\` on it will fail on any unused import.

Then verify with tools rather than memory:
- \`list_dir\` and confirm every required file above exists.
- Confirm every \`@/\` import resolves to a file that exists.
- Confirm every route you link to has a component.
- Run \`pnpm lint\` if the project has it, and fix what it reports.`;
