cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Arret Node..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Creation correctif encodage..." -ForegroundColor Cyan

@'
const fs = require("fs");
const path = require("path");

const root = process.cwd();

const extensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".md",
  ".html",
  ".css",
]);

const ignoredDirs = new Set([
  "node_modules",
  ".next",
  ".turbo",
  ".git",
]);

const leftArrowVariants = [
  String.fromCharCode(0x2190),
  String.fromCharCode(0x00e2, 0x2020, 0x0090),
  String.fromCharCode(0x00e2, 0x0086, 0x0090),
];

const rightArrowVariants = [
  String.fromCharCode(0x2192),
  String.fromCharCode(0x00e2, 0x2020, 0x2019),
  String.fromCharCode(0x00e2, 0x0086, 0x0092),
];

const suspiciousMarkers = [
  String.fromCharCode(0x00e2),
  String.fromCharCode(0x00f0),
  String.fromCharCode(0x00c3),
  String.fromCharCode(0xfffd),
];

const changedFiles = [];
const suspiciousFiles = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;

  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (ignoredDirs.has(item)) continue;
      walk(full);
      continue;
    }

    if (!extensions.has(path.extname(full))) continue;

    let content = fs.readFileSync(full, "utf8");
    const original = content;

    for (const variant of leftArrowVariants) {
      content = content.split(variant).join("Precedent");
    }

    for (const variant of rightArrowVariants) {
      content = content.split(variant).join("Suivant");
    }

    if (content !== original) {
      fs.writeFileSync(full, content, "utf8");
      changedFiles.push(path.relative(root, full));
    }

    const after = fs.readFileSync(full, "utf8");
    if (suspiciousMarkers.some((marker) => after.includes(marker))) {
      suspiciousFiles.push(path.relative(root, full));
    }
  }
}

walk(path.join(root, "apps"));
walk(path.join(root, "packages"));

console.log("");
console.log("Fichiers corriges :");
if (changedFiles.length === 0) {
  console.log("- Aucun fichier modifie");
} else {
  for (const file of changedFiles) console.log("- " + file);
}

console.log("");
console.log("Fichiers encore suspects :");
if (suspiciousFiles.length === 0) {
  console.log("- Aucun");
} else {
  for (const file of suspiciousFiles) console.log("- " + file);
}
'@ | Set-Content "fix-remaining-encoding.js" -Encoding UTF8

Write-Host "Application correctif..." -ForegroundColor Cyan
node .\fix-remaining-encoding.js

Write-Host "Suppression script temporaire..." -ForegroundColor Cyan
Remove-Item "fix-remaining-encoding.js" -Force -ErrorAction SilentlyContinue

Write-Host "Nettoyage cache Next/Turbo..." -ForegroundColor Cyan
Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.turbo" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Commit + push..." -ForegroundColor Cyan
git add .
git commit -m "fix remaining encoding artifacts"
git push origin main

Write-Host ""
Write-Host "Correction terminee." -ForegroundColor Green
Write-Host "Relance : npm run dev" -ForegroundColor Green