const fs = require("fs");
const htmlPath = process.argv[2];
const html = fs.readFileSync(htmlPath, "utf8");
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);

let ok = true;

scripts.forEach((code, index) => {
  const tmp = htmlPath + ".script_" + (index + 1) + ".js";
  fs.writeFileSync(tmp, code, "utf8");

  const cp = require("child_process").spawnSync(process.execPath, ["--check", tmp], {
    encoding: "utf8"
  });

  fs.unlinkSync(tmp);

  if (cp.status !== 0) {
    ok = false;
    console.error("SCRIPT NG:", index + 1);
    console.error(cp.stderr || cp.stdout);
  }
});

if (!ok) process.exit(1);
console.log("OK: HTML script check success scripts=" + scripts.length);
