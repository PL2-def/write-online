# C:\Users\PL2\Documents\write\sync.ps1
<#
.SYNOPSIS
    Script intelligent de synchronisation et déploiement pour GitHub.
    Gère les blocages Git, les conflits mineurs et les désynchronisations.
#>

$RemoteURL = "https://github.com/PL2-def/write-online.git"
$Branch = "main"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Function Write-Step([string]$msg) {
    Write-Host "`n[STEP] $msg" -ForegroundColor Cyan
}

Function Check-GitOperation {
    if (Test-Path ".git\rebase-merge") {
        Write-Host "[WARN] Rebase en cours détecté. Annulation..." -ForegroundColor Yellow
        git rebase --abort
    }
    if (Test-Path ".git\MERGE_HEAD") {
        Write-Host "[WARN] Merge en cours détecté. Annulation..." -ForegroundColor Yellow
        git merge --abort
    }
}

try {
    Write-Step "Nettoyage de l'état Git..."
    Check-GitOperation

    Write-Step "Vérification de la configuration..."
    if (!(git remote get-url origin 2>$null)) {
        git remote add origin $RemoteURL
    } else {
        git remote set-url origin $RemoteURL
    }

    Write-Step "Récupération des changements distants..."
    git fetch origin $Branch

    Write-Step "Gestion des changements locaux..."
    $status = git status --porcelain
    if ($status) {
        Write-Host "Changements locaux détectés. Création d'un point de sauvegarde..."
        git add .
        git commit -m "Auto-save: $Timestamp"
    }

    Write-Step "Synchronisation avec GitHub..."
    # On tente un merge plutôt qu'un rebase pour plus de sécurité
    # On privilégie notre version en cas de conflit sur des fichiers de backup
    git merge origin/$Branch -m "Merge remote changes: $Timestamp"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[CONFLICT] Tentative de résolution automatique des conflits mineurs..." -ForegroundColor Yellow
        # Résolution auto : on supprime les fichiers .backup s'ils bloquent (comme vu précédemment)
        if (git status | Select-String "index.html.backup") {
             Write-Host "Suppression automatique du fichier de backup conflictuel..."
             git rm index.html.backup
             git commit -m "Resolved conflict on backup file automatically"
        } else {
            throw "Conflit complexe détecté. Intervention manuelle requise."
        }
    }

    Write-Step "Envoi vers GitHub..."
    git push origin $Branch

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Succès : Le projet est à jour sur GitHub !" -ForegroundColor Green
    } else {
        throw "Échec du push vers GitHub."
    }

} catch {
    Write-Host "`n❌ Erreur : $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Conseil : Vérifiez votre connexion internet ou vos permissions GitHub."
    exit 1
}
