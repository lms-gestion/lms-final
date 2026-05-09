cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Arret Node..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Ajout action Replanifier pour interventions annulees..." -ForegroundColor Cyan

@'
const fs = require("fs");
const path = require("path");

const root = process.cwd();

const routerPath = path.join(
  root,
  "apps",
  "web",
  "lib",
  "trpc",
  "routers",
  "interventions.ts"
);

const planningPath = path.join(
  root,
  "apps",
  "web",
  "app",
  "(app)",
  "planning",
  "planning-client.tsx"
);

if (!fs.existsSync(routerPath)) {
  throw new Error("Fichier introuvable: " + routerPath);
}

if (!fs.existsSync(planningPath)) {
  throw new Error("Fichier introuvable: " + planningPath);
}

let router = fs.readFileSync(routerPath, "utf8");

const oldStatusBlock = `    const values = {
      status: input.status,
      updatedAt: new Date(),
      ...(input.status === 'en_cours' ? { arrivedAt: new Date() } : {}),
      ...(input.status === 'terminee' ? { completedAt: new Date() } : {}),
      ...(input.status === 'annulee' ? { cancelledAt: new Date() } : {}),
    }`;

const newStatusBlock = `    const now = new Date()

    const values: Record<string, any> = {
      status: input.status,
      updatedAt: now,
    }

    if (input.status === 'planifiee') {
      values.arrivedAt = null
      values.completedAt = null
      values.cancelledAt = null
      values.cancellationReason = null
    }

    if (input.status === 'en_cours') {
      values.arrivedAt = now
      values.completedAt = null
      values.cancelledAt = null
      values.cancellationReason = null
    }

    if (input.status === 'terminee') {
      values.completedAt = now
      values.cancelledAt = null
      values.cancellationReason = null
    }

    if (input.status === 'annulee') {
      values.cancelledAt = now
    }

    if (input.status === 'reportee') {
      values.cancelledAt = null
      values.cancellationReason = null
    }`;

if (router.includes(oldStatusBlock)) {
  router = router.replace(oldStatusBlock, newStatusBlock);
  fs.writeFileSync(routerPath, router, "utf8");
  console.log("OK router interventions.ts corrige");
} else if (router.includes("const now = new Date()") && router.includes("values.cancelledAt = null")) {
  console.log("SKIP router deja corrige");
} else {
  console.log("WARN bloc updateStatus non trouve dans interventions.ts");
}

let planning = fs.readFileSync(planningPath, "utf8");

if (!planning.includes("Replanifier")) {
  const oldActionsBlock = `                  {intervention.status !== 'annulee' && intervention.status !== 'terminee' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus.mutate({ id: intervention.id, status: 'annulee' })
                      }
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Annuler
                    </button>
                  )}`;

  const newActionsBlock = `                  {(intervention.status === 'annulee' || intervention.status === 'reportee') && (
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus.mutate({ id: intervention.id, status: 'planifiee' })
                      }
                      className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                    >
                      Replanifier
                    </button>
                  )}

                  {intervention.status !== 'annulee' && intervention.status !== 'terminee' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus.mutate({ id: intervention.id, status: 'annulee' })
                      }
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Annuler
                    </button>
                  )}`;

  if (planning.includes(oldActionsBlock)) {
    planning = planning.replace(oldActionsBlock, newActionsBlock);
    fs.writeFileSync(planningPath, planning, "utf8");
    console.log("OK bouton Replanifier ajoute");
  } else {
    console.log("WARN bloc bouton Annuler non trouve dans planning-client.tsx");
  }
} else {
  console.log("SKIP bouton Replanifier deja present");
}
'@ | Set-Content "fix-intervention-replanifier.js" -Encoding UTF8

node .\fix-intervention-replanifier.js

Remove-Item "fix-intervention-replanifier.js" -Force -ErrorAction SilentlyContinue

Write-Host "Nettoyage cache Next/Turbo..." -ForegroundColor Cyan

Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.turbo" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Commit + push GitHub..." -ForegroundColor Cyan

git add .
git commit -m "allow replanning cancelled interventions"
git push origin main

Write-Host ""
Write-Host "Correction terminee." -ForegroundColor Green
Write-Host "Relance : npm run dev" -ForegroundColor Green
Write-Host "Teste : http://localhost:3000/planning" -ForegroundColor Green