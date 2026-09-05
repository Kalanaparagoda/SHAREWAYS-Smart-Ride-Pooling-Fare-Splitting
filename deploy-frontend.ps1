Write-Host "Building and Deploying SHAREWAYS Frontend to Firebase Hosting..." -ForegroundColor Cyan

cd frontend

Write-Host "Installing dependencies (if any)..." -ForegroundColor Yellow
npm install

Write-Host "Building production bundle..." -ForegroundColor Yellow
npm run build

Write-Host "Deploying to Firebase Hosting..." -ForegroundColor Yellow
npx --yes firebase-tools deploy --only hosting --non-interactive

cd ..
Write-Host "Frontend deployment complete!" -ForegroundColor Green
