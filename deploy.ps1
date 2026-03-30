# C:\Users\PL2\Documents\write\deploy.ps1

$RemoteRepo = "https://github.com/PL2-def/write-online.git"
$Branch = "main"

Write-Host "Deployment to $RemoteRepo..."

# Init Git
if (!(Test-Path ".git")) {
    Write-Host "Initializing Git..."
    git init
}

# Author identity (prevent errors if not set)
$userEmail = git config user.email
if ([string]::IsNullOrWhiteSpace($userEmail)) {
    Write-Host "Setting local author identity..."
    git config --local user.email "deploy@example.com"
    git config --local user.name "Auto Deployer"
}

# Remote configuration
$currentRemote = git remote get-url origin 2>$null
if ($null -eq $currentRemote) {
    Write-Host "Adding remote origin..."
    git remote add origin $RemoteRepo
} elseif ($currentRemote -ne $RemoteRepo) {
    Write-Host "Updating remote origin..."
    git remote set-url origin $RemoteRepo
}

# Add & Commit
Write-Host "Staging files..."
git staging . 2>$null # workaround for some git aliases
git add .
$commitMsg = "Deploy update: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Write-Host "Creating commit: $commitMsg"
git commit -m "$commitMsg"

# Branch management
git branch -M $Branch

# Push
Write-Host "Pushing to GitHub..."
git push -u origin $Branch

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment successful!"
} else {
    Write-Host "Deployment failed (check credentials or repo existence)."
}
