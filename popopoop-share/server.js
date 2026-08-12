import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { networkInterfaces } from "node:os";
import { fetchSteamGame, parseSteamAppId } from "./steam.js";

const root = resolve("public"), stateFile = resolve("data/state.json"), publicStateFile = resolve("docs/state.json"), port = Number(process.env.PORT) || 8791;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png" };
const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(value)); };
const body = req => new Promise((resolveBody, reject) => { let value = ""; req.on("data", chunk => value += chunk); req.on("end", () => { try { resolveBody(JSON.parse(value || "{}")); } catch (error) { reject(error); } }); req.on("error", reject); });
const cleanState = raw => ({ brand: raw?.brand || {}, showcaseGames: Array.isArray(raw?.showcaseGames) ? raw.showcaseGames : [] });
const localAddresses = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
Object.values(networkInterfaces()).flat().filter(Boolean).forEach(item => localAddresses.add(item.address));
const isLocalAdmin = req => { const address = req.socket.remoteAddress || ""; return localAddresses.has(address) || (address.startsWith("::ffff:") && localAddresses.has(address.slice(7))); };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/api/state") return json(res, 200, cleanState(JSON.parse(await readFile(stateFile, "utf8"))));
    if (req.method === "GET" && url.pathname === "/api/admin-access") return json(res, 200, { allowed: isLocalAdmin(req) });
    if (req.method === "PUT" && url.pathname === "/api/state") { if (!isLocalAdmin(req)) return json(res, 403, { error: "관리자 편집은 서버 컴퓨터에서만 가능합니다." }); const value = cleanState(await body(req)), serialized = JSON.stringify(value, null, 2); await Promise.all([writeFile(stateFile, serialized, "utf8"), writeFile(publicStateFile, serialized, "utf8")]); return json(res, 200, { saved: true }); }
    if (req.method === "GET" && url.pathname === "/api/steam") { if (!isLocalAdmin(req)) return json(res, 403, { error: "관리자 편집은 서버 컴퓨터에서만 가능합니다." }); const appId = parseSteamAppId(url.searchParams.get("url")); if (!appId) return json(res, 400, { error: "올바른 Steam 상점 링크를 입력하세요." }); return json(res, 200, await fetchSteamGame(appId)); }
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname, file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root)) return json(res, 403, { error: "Forbidden" });
    try { const data = await readFile(file); res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" }); res.end(data); }
    catch { const data = await readFile(resolve(root, "index.html")); res.writeHead(200, { "content-type": types[".html"] }); res.end(data); }
  } catch (error) { json(res, 500, { error: error.message }); }
});
server.listen(port, "0.0.0.0", () => console.log(`공유 사이트: http://localhost:${port}`));
