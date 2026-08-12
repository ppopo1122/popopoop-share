import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(), output = resolve("docs"), source = resolve("public");
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "assets"), { recursive: true });
const raw = JSON.parse(await readFile(resolve("data/state.json"), "utf8"));
const state = { brand: raw.brand || {}, showcaseGames: Array.isArray(raw.showcaseGames) ? raw.showcaseGames : [] };
const html = `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="똥겜녀 노방종 게임 가이드"><title>${state.brand.title || "똥겜녀"} · 노방종 게임</title><link rel="stylesheet" href="./styles.css"></head><body><header><a class="brand" href="#home"><img src="./assets/brand-logo.png" alt=""><b id="brandTitle">${state.brand.title || "똥겜녀"}</b></a><nav><a href="#home">홈</a><a href="#games">노방종 게임</a></nav></header><main id="app"></main><script type="module" src="./app-public.js"></script></body></html>`;
await Promise.all([
  writeFile(resolve(output, "index.html"), html, "utf8"),
  writeFile(resolve(output, "state.json"), JSON.stringify(state), "utf8"),
  cp(resolve(source, "styles.css"), resolve(output, "styles.css")),
  cp(resolve(source, "app-public.js"), resolve(output, "app-public.js")),
  cp(resolve(source, "assets", "brand-logo.png"), resolve(output, "assets", "brand-logo.png")),
  writeFile(resolve(output, ".nojekyll"), "", "utf8"),
]);
console.log(`GitHub Pages 공개본 생성 완료: ${output}`);
