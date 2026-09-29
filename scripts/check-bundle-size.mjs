// Fails when the JavaScript loaded before the first page renders (the entry script plus
// its modulepreloads in dist/index.html) exceeds the budget (PLT-1). Run after `vite build`.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BUDGET_KB = 250;

const html = readFileSync("dist/index.html", "utf8");
const files = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((match) => match[1]);
const kb = files.reduce((sum, file) => sum + gzipSync(readFileSync(`dist/${file}`)).length, 0) / 1024;

console.log(`Initial JS: ${kb.toFixed(1)} kB gzipped across ${files.length} file(s); budget ${BUDGET_KB} kB.`);
if (files.length === 0 || kb > BUDGET_KB) process.exit(1);
