# C:\Users\PL2\Documents\write\deploy.ps1

$RemoteRepo = "https://github.com/PL2-def/write-online.git"
$Branch = "main"

Write-Host "Deployment to $RemoteRepo..."

# Init Git
if (!(Test-Path ".git")) {
    Write-Host "Initializing Git..."
    git init
}

# Author identity
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
git add .
$commitMsg = "Deploy update: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Write-Host "Creating commit: $commitMsg"
git commit -m "$commitMsg"

# Branch management
git branch -M $Branch

# Pull remote changes (handle existing work)
Write-Host "Pulling remote changes..."
git pull origin $Branch --rebase --allow-unrelated-histories

# Push
Write-Host "Pushing to GitHub..."
git push -u origin $Branch

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment successful!"
} else {
    Write-Host "Deployment failed. Check for merge conflicts or credentials."
}
