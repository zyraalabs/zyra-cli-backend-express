import { basename } from "path";

export function parseProjectName(output: string): string {
  const pkgMatch = output.match(/<file path="package\.json">([\s\S]*?)<\/file>/);
  if (pkgMatch) {
    const nameMatch = pkgMatch[1].match(/"name"\s*:\s*"([^"]+)"/);
    if (nameMatch?.[1] && !nameMatch[1].includes("<")) return nameMatch[1];
  }
  return basename(process.cwd());
}
