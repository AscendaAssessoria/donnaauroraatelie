// Servidor estático da landing Donna Aurora (sem dependências).
// A Hostinger define a porta em process.env.PORT.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2"
};

// Arquivos internos que não devem ser servidos
const BLOCKED = new Set(["server.js", "package.json", "package-lock.json", "LEIA-ME.txt", "trazer-fotos-do-site-antigo.sh"]);

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ "Content-Type": "text/plain; charset=utf-8" }, headers || {}));
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Método não permitido", { Allow: "GET, HEAD" });

  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch (e) { return send(res, 400, "Requisição inválida"); }

  if (urlPath.endsWith("/")) urlPath += "index.html";
  const filePath = path.normalize(path.join(ROOT, urlPath));

  // Impede sair da pasta do site e acessar arquivos internos/ocultos
  if (!filePath.startsWith(ROOT + path.sep)) return send(res, 403, "Acesso negado");
  const rel = path.relative(ROOT, filePath);
  if (BLOCKED.has(rel) || rel.split(path.sep).some((p) => p.startsWith(".") || p === "node_modules")) return send(res, 404, "Não encontrado");

  fs.stat(filePath, (err, stat) => {
    // Qualquer rota desconhecida sem extensão volta para a página principal
    if (err || !stat.isFile()) {
      if (!path.extname(urlPath)) return serveFile(req, res, path.join(ROOT, "index.html"));
      return send(res, 404, "Não encontrado");
    }
    serveFile(req, res, filePath, stat);
  });
});

function serveFile(req, res, filePath, stat) {
  stat = stat || fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    // HTML sempre atualizado; imagens e vídeos em cache por 7 dias
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=604800"
  };

  // Suporte a Range: necessário para os vídeos tocarem no iPhone/Safari
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : NaN;
    let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (m && !m[1] && m[2]) { start = stat.size - parseInt(m[2], 10); end = stat.size - 1; }
    if (!m || isNaN(start) || start < 0 || start >= stat.size || end < start) {
      return send(res, 416, "", { "Content-Range": `bytes */${stat.size}` });
    }
    end = Math.min(end, stat.size - 1);
    headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
    headers["Content-Length"] = end - start + 1;
    res.writeHead(206, headers);
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(filePath, { start, end }).pipe(res);
  }

  headers["Content-Length"] = stat.size;
  res.writeHead(200, headers);
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(filePath).pipe(res);
}

server.listen(PORT, () => console.log(`Donna Aurora no ar na porta ${PORT}`));
