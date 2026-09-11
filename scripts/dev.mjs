import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const children = [
  spawn(process.env.MIDWAY_PYTHON || "python", ["-m", "server.app"], { cwd: root, stdio: "inherit", windowsHide: true }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", ...(process.argv.includes("--preview") ? ["preview"] : [])], { cwd: root, stdio: "inherit", windowsHide: true }),
];
let stopping = false;
function stop(code=0) { if (stopping) return; stopping=true; for (const child of children) child.kill(); process.exitCode=code; }
for (const child of children) {
  child.on("error", error=>{ console.error(error.message); stop(1); });
  child.on("exit", code=>stop(code ?? 1));
}
process.on("SIGINT",()=>stop());
process.on("SIGTERM",()=>stop());
