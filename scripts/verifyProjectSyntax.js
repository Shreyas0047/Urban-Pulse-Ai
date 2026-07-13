const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const roots = ["src", "public", "scripts"];
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.isFile() && target.endsWith(".js")) files.push(target);
  }
}
roots.forEach(walk);
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "");
    process.exit(result.status || 1);
  }
}
require("../src/app");
console.log(JSON.stringify({ passed: true, javascriptFilesChecked: files.length, appLoaded: true }, null, 2));
