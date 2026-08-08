import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const hash = execSync("git rev-parse --short HEAD", { cwd: join(process.cwd()) }).toString().trim();
    const msg = execSync("git log -1 --pretty=%B", { cwd: join(process.cwd()) }).toString().trim().split("\n")[0];
    const date = new Date().toISOString().split("T")[0];
    
    // Read version from package.json
    const pkgPath = join(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const version = pkg.version || "0.0.0";
    
    return Response.json({
      version,
      date,
      description: msg,
      hash,
      changes: [msg],
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
