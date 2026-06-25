const fs = require("fs");
const path = require("path");
const config = require("./config");

function serveStatic(req, res) {
  const reqPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const fullPath = path.join(config.publicDir, decodeURIComponent(reqPath));

  if (!fullPath.startsWith(config.publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }

    const ext = path.extname(fullPath).toLowerCase();
    const type =
      ext === ".html" ? "text/html; charset=utf-8" :
      ext === ".js" ? "text/javascript; charset=utf-8" :
      ext === ".css" ? "text/css; charset=utf-8" :
      "application/octet-stream";

    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

module.exports = {
  serveStatic,
};
