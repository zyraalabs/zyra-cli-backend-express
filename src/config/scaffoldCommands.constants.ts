import { SupportedFramework } from "./frameworkDetection.constants";

export const SCAFFOLD_COMMANDS: Record<SupportedFramework, string> = {
  nextjs:
    "pnpm create next-app . --typescript --tailwind --turbopack --app --src-dir --import-alias '@/*' --yes",
  "vite-react":
    "pnpm create vite@latest . --template react-ts && pnpm add -D tailwindcss postcss @tailwindcss/postcss autoprefixer && pnpm exec tailwindcss init -p",
  express: "",
};
