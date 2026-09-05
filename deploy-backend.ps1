Write-Host "Deploying SHAREWAYS Backend to Google Cloud Run..." -ForegroundColor Cyan

$project = gcloud config get-value project
if (-not $project) {
    Write-Host "Error: No GCP project set. Please run 'gcloud config set project YOUR_PROJECT_ID'" -ForegroundColor Red
    exit 1
}

Write-Host "Using GCP Project: $project" -ForegroundColor Yellow

cd backend

# Deploy to Cloud Run using source code (automatically builds container)
gcloud run deploy commuteshare-backend `
    --source . `
    --platform managed `
    --region asia-south1 `
    --allow-unauthenticated `
    --project $project

cd ..
Write-Host "Backend deployment complete!" -ForegroundColor Green
