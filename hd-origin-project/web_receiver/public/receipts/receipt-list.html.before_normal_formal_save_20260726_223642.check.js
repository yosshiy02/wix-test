const fs = require("fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = re.exec(html)) !== null) {
  new Function(match[1]);
  count++;
}
console.log("INLINE_SCRIPT_COUNT=" + count);
console.log("HTML_SCRIPT_SYNTAX=SUCCESS");