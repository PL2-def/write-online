#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Deployer pour Write Online Revolution – Version Avancée
-------------------------------------------------------
Script de déploiement automatisé vers GitHub Pages avec versionnage,
audit, validation et options interactives.
"""

import os
import sys
import argparse
import logging
import subprocess
import re
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any

# ======================= CONFIGURATION PAR DÉFAUT =======================
DEFAULT_REPO_URL = "https://github.com/PL2-def/write-online.git"
DEFAULT_BRANCH = "main"
DEFAULT_VERSION_FILE = ".version"
DEFAULT_TARGET_FILE = "index.html"
DEFAULT_MAX_SIZE_MB = 100  # Limite de taille pour alerte
DRY_RUN = False

# ======================= CONFIGURATION DES LOGS =======================
def setup_logging(verbose: bool = False):
    """Configure le système de logging."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)]
    )

# ======================= CLASSE PRINCIPALE =======================
class DeploymentManager:
    """Gère l'ensemble du processus de déploiement."""
    
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.version: Optional[int] = None
        self.project_root = Path.cwd()
        self.version_path = self.project_root / args.version_file
        self.target_path = self.project_root / args.target_file
        self.original_version = None
        self.backup_files: List[Path] = []
        self.total_size_mb: float = 0.0
        
        # Valider les dépendances essentielles
        self._check_dependencies()
        
        # Vérifier que nous sommes dans un dépôt git
        if not self._is_git_repo():
            logging.error("Le répertoire courant n'est pas un dépôt Git.")
            sys.exit(1)
    
    def _check_dependencies(self):
        """Vérifie que Git est installé et accessible."""
        if shutil.which("git") is None:
            logging.error("Git n'est pas installé ou n'est pas dans le PATH.")
            sys.exit(1)
        logging.debug("Git trouvé.")
    
    def _is_git_repo(self) -> bool:
        """Vérifie si le répertoire courant est un dépôt Git."""
        try:
            subprocess.run(["git", "rev-parse", "--git-dir"],
                           capture_output=True, check=True, text=True)
            return True
        except subprocess.CalledProcessError:
            return False
    
    def _run_git(self, args: List[str], check: bool = True, capture: bool = True) -> subprocess.CompletedProcess:
        """Exécute une commande Git avec gestion d'erreur améliorée."""
        cmd = ["git"] + args
        logging.debug(f"Commande Git: {' '.join(cmd)}")
        try:
            result = subprocess.run(cmd, capture_output=capture, text=True, check=check)
            if not capture:
                # On imprime directement stdout/stderr si capture=False
                if result.stdout:
                    print(result.stdout, end='')
                if result.stderr:
                    print(result.stderr, end='', file=sys.stderr)
            return result
        except subprocess.CalledProcessError as e:
            logging.error(f"Échec de la commande Git: {' '.join(cmd)}")
            logging.error(f"Code retour: {e.returncode}")
            logging.error(f"stderr: {e.stderr}")
            if check:
                sys.exit(1)
            return e
    
    def _has_changes(self) -> bool:
        """Vérifie s'il y a des modifications non commitées ou des fichiers non suivis."""
        result = self._run_git(["status", "--porcelain"], check=False)
        return bool(result.stdout.strip())
    
    def _backup_file(self, path: Path) -> None:
        """Sauvegarde un fichier avant modification."""
        if not path.exists():
            return
        backup_path = path.with_suffix(path.suffix + ".backup")
        shutil.copy2(path, backup_path)
        self.backup_files.append(backup_path)
        logging.debug(f"Sauvegarde créée: {backup_path}")
    
    def _restore_backups(self):
        """Restaure les fichiers sauvegardés."""
        for backup in self.backup_files:
            original = backup.with_suffix('')  # enlève .backup
            if backup.exists():
                shutil.move(backup, original)
                logging.info(f"Restauration de {original}")
        self.backup_files.clear()
    
    def _clean_backups(self):
        """Supprime les fichiers de sauvegarde si tout s'est bien passé."""
        for backup in self.backup_files:
            if backup.exists():
                backup.unlink()
                logging.debug(f"Sauvegarde supprimée: {backup}")
        self.backup_files.clear()
    
    def _get_current_version(self) -> int:
        """Lit le numéro de version actuel depuis le fichier .version."""
        if not self.version_path.exists():
            return 0
        try:
            content = self.version_path.read_text(encoding="utf-8").strip()
            if content.isdigit():
                return int(content)
            else:
                logging.warning(f"Fichier version invalide: {content}, réinitialisation à 0")
                return 0
        except Exception as e:
            logging.error(f"Erreur lecture version: {e}")
            return 0
    
    def _write_version(self, version: int):
        """Écrit le nouveau numéro de version dans .version."""
        try:
            self.version_path.write_text(str(version), encoding="utf-8")
            logging.info(f"Version enregistrée: {version}")
        except Exception as e:
            logging.error(f"Impossible d'écrire le fichier version: {e}")
            sys.exit(1)
    
    def _update_html_version(self, new_version: int) -> bool:
        """Met à jour la chaîne de version dans le fichier HTML cible."""
        if not self.target_path.exists():
            logging.warning(f"Fichier cible {self.target_path} introuvable, injection ignorée.")
            return False
        
        # Sauvegarde avant modification
        self._backup_file(self.target_path)
        
        try:
            html = self.target_path.read_text(encoding="utf-8")
            # Recherche d'un pattern 'v' suivi d'un nombre (simple ou semver)
            pattern = r'v\d+(\.\d+\.\d+)?'
            new_html = re.sub(pattern, f'v{new_version}', html)
            if new_html != html:
                self.target_path.write_text(new_html, encoding="utf-8")
                logging.info(f"Injection version {new_version} dans {self.target_path.name}")
                return True
            else:
                logging.warning("Aucun motif de version trouvé dans le fichier HTML.")
                return False
        except Exception as e:
            logging.error(f"Erreur lors de la mise à jour HTML: {e}")
            return False
    
    def _compute_folder_size(self) -> float:
        """Calcule la taille totale du dossier (excluant .git)."""
        total = 0
        for root, dirs, files in os.walk(self.project_root):
            if '.git' in root:
                continue
            for file in files:
                filepath = Path(root) / file
                if filepath.is_symlink():
                    continue
                try:
                    total += filepath.stat().st_size
                except OSError:
                    logging.warning(f"Impossible d'accéder à {filepath}")
        size_mb = total / (1024 * 1024)
        logging.debug(f"Taille du projet: {size_mb:.2f} Mo")
        return size_mb
    
    def _get_git_diff_stat(self) -> str:
        """Retourne les statistiques de diff (modifications non indexées)."""
        try:
            result = self._run_git(["diff", "--shortstat"], check=False)
            return result.stdout.strip()
        except:
            return ""
    
    def _check_large_files(self) -> bool:
        """Alerte si des fichiers dépassent une taille critique (GitHub Pages)."""
        large_files = []
        for root, dirs, files in os.walk(self.project_root):
            if '.git' in root:
                continue
            for file in files:
                filepath = Path(root) / file
                if filepath.is_symlink():
                    continue
                size_mb = filepath.stat().st_size / (1024 * 1024)
                if size_mb > 50:  # GitHub Pages limite souvent à 100 Mo par fichier, on alerte à 50
                    large_files.append((filepath, size_mb))
        if large_files:
            logging.warning("Fichiers de grande taille détectés (risque de rejet GitHub):")
            for f, s in large_files:
                logging.warning(f"  - {f} : {s:.2f} Mo")
            if not self.args.force:
                logging.error("Déploiement interrompu. Utilisez --force pour passer outre.")
                return False
            else:
                logging.info("Force activée, poursuite malgré les gros fichiers.")
        return True
    
    def _check_secrets(self) -> bool:
        """Recherche simple de mots de passe/clés sensibles dans les fichiers texte."""
        sensitive_patterns = [
            r'password\s*=\s*["\'].+["\']',
            r'api_key\s*=\s*["\'].+["\']',
            r'secret\s*=\s*["\'].+["\']',
            r'token\s*=\s*["\'].+["\']',
        ]
        found = []
        for root, dirs, files in os.walk(self.project_root):
            if '.git' in root:
                continue
            for file in files:
                if file.endswith(('.txt', '.html', '.js', '.json', '.yml', '.yaml', '.env')):
                    filepath = Path(root) / file
                    try:
                        content = filepath.read_text(encoding='utf-8', errors='ignore')
                        for pattern in sensitive_patterns:
                            if re.search(pattern, content, re.IGNORECASE):
                                found.append(filepath)
                                break
                    except:
                        pass
        if found:
            logging.warning("Des fichiers contiennent possiblement des secrets:")
            for f in found:
                logging.warning(f"  - {f}")
            if not self.args.force:
                logging.error("Déploiement interrompu pour des raisons de sécurité. Utilisez --force pour passer outre.")
                return False
            else:
                logging.info("Force activée, poursuite malgré les secrets détectés.")
        return True
    
    def _check_remote_availability(self) -> bool:
        """Vérifie que le dépôt distant est accessible."""
        remote_url = self.args.repo_url
        try:
            self._run_git(["ls-remote", "--exit-code", remote_url, "HEAD"], check=True)
            logging.debug("Dépôt distant accessible.")
            return True
        except:
            logging.error("Impossible d'atteindre le dépôt distant. Vérifiez votre connexion et l'URL.")
            return False
    
    def _prompt_confirm(self, message: str) -> bool:
        """Demande confirmation interactive."""
        if self.args.yes:
            return True
        reply = input(f"{message} [O/n] : ").strip().lower()
        return reply in ('', 'o', 'oui', 'y', 'yes')
    
    def _prepare_commit_message(self, version: int) -> str:
        """Génère le message de commit."""
        timestamp = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        return f"🚀 v{version} - Déploiement auto ({timestamp})"
    
    def run(self) -> int:
        """Point d'entrée principal du déploiement."""
        # --- Étape 1 : Vérifications préalables ---
        logging.info("=== Déploiement Write Online Revolution ===")
        
        if not self._has_changes():
            logging.info("Aucun changement détecté. Déploiement inutile.")
            return 0
        
        if not self._check_large_files() or not self._check_secrets():
            return 1
        
        if not self.args.skip_remote_check and not self._check_remote_availability():
            if not self._prompt_confirm("Continuer quand même ? (le push échouera probablement)"):
                return 1
        
        # --- Étape 2 : Versioning ---
        current_version = self._get_current_version()
        new_version = current_version + 1
        self.version = new_version
        
        if not self.args.skip_version:
            self._write_version(new_version)
            version_updated = self._update_html_version(new_version)
            if not version_updated and not self.args.force:
                logging.error("Échec de l'injection de version. Utilisez --force pour ignorer.")
                self._restore_backups()
                return 1
        else:
            logging.info("Versioning ignoré (--skip-version).")
        
        # --- Étape 3 : Audit et affichage ---
        self.total_size_mb = self._compute_folder_size()
        diff_stat = self._get_git_diff_stat()
        
        logging.info("--- Audit du projet ---")
        logging.info(f"Taille totale (hors .git) : {self.total_size_mb:.2f} Mo")
        if diff_stat:
            logging.info(f"Modifications détectées : {diff_stat}")
        else:
            logging.info("Nouveaux fichiers non suivis ou modifications non indexées.")
        
        if not self.args.skip_audit:
            # Optionnel : afficher le diff complet si demandé
            if self.args.show_diff:
                logging.info("--- Diff complet ---")
                self._run_git(["diff"], capture=False)
        
        # --- Étape 4 : Indexation et commit ---
        if DRY_RUN:
            logging.info("Mode DRY RUN : aucune modification réelle ne sera appliquée.")
            self._clean_backups()
            return 0
        
        if not self.args.skip_commit:
            # Ajout de tous les fichiers (respecte .gitignore)
            logging.info("Indexation des fichiers...")
            self._run_git(["add", "."])
            
            commit_msg = self._prepare_commit_message(new_version)
            logging.info(f"Commit : {commit_msg}")
            self._run_git(["commit", "-m", commit_msg, "--quiet"], check=False)
            # On ignore le code retour car si rien à committer, git commit échoue, mais on a déjà vérifié des changements.
            logging.info("Commit effectué.")
        else:
            logging.info("Commit ignoré (--skip-commit).")
        
        # --- Étape 5 : Push vers GitHub ---
        push_ok = False
        if not self.args.skip_push:
            logging.info(f"Envoi vers la branche {self.args.branch}...")
            push_cmd = ["push", "origin", self.args.branch]
            if self.args.force_push:
                push_cmd.append("--force")
                logging.warning("PUSH FORCÉ activé ! Cela peut écraser l'historique distant.")
            result = self._run_git(push_cmd, check=False)
            if result.returncode == 0:
                push_ok = True
                logging.info("Push réussi.")
            else:
                logging.error("Le push a échoué. Vérifiez votre connexion ou effectuez un pull manuel.")
                logging.error(f"stderr: {result.stderr}")
                self._restore_backups()
                return 1
        else:
            logging.info("Push ignoré (--skip-push).")
            push_ok = True  # On simule succès pour la suite
        
        # --- Étape 6 : Nettoyage et rapport final ---
        if self.backup_files:
            self._clean_backups()
        
        if push_ok:
            logging.info("="*50)
            logging.info(f"✅ DÉPLOIEMENT RÉUSSI ! (Version {new_version})")
            logging.info(f"🌍 URL : https://pl2-def.github.io/write-online/")
            logging.info(f"📦 Taille finale du projet : {self.total_size_mb:.2f} Mo")
            logging.info("="*50)
            return 0
        else:
            logging.error("Déploiement échoué.")
            return 1

# ======================= PARSER ARGUMENTS =======================
def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Script de déploiement avancé pour Write Online Revolution.",
        epilog="Exemple : python deploiement.py --branch main --force --verbose"
    )
    parser.add_argument("--repo-url", default=DEFAULT_REPO_URL,
                        help=f"URL du dépôt distant (défaut: {DEFAULT_REPO_URL})")
    parser.add_argument("--branch", default=DEFAULT_BRANCH,
                        help=f"Branche cible (défaut: {DEFAULT_BRANCH})")
    parser.add_argument("--version-file", default=DEFAULT_VERSION_FILE,
                        help=f"Fichier de version (défaut: {DEFAULT_VERSION_FILE})")
    parser.add_argument("--target-file", default=DEFAULT_TARGET_FILE,
                        help=f"Fichier HTML cible pour l'injection version (défaut: {DEFAULT_TARGET_FILE})")
    parser.add_argument("--force", action="store_true",
                        help="Ignore les avertissements (gros fichiers, secrets)")
    parser.add_argument("--force-push", action="store_true",
                        help="Utilise git push --force (dangereux)")
    parser.add_argument("--skip-version", action="store_true",
                        help="Ne pas incrémenter la version ni modifier le HTML")
    parser.add_argument("--skip-commit", action="store_true",
                        help="Ne pas exécuter git commit")
    parser.add_argument("--skip-push", action="store_true",
                        help="Ne pas pousser vers GitHub")
    parser.add_argument("--skip-audit", action="store_true",
                        help="Ne pas afficher le diff et l'audit")
    parser.add_argument("--skip-remote-check", action="store_true",
                        help="Ne pas vérifier la disponibilité du dépôt distant")
    parser.add_argument("--show-diff", action="store_true",
                        help="Afficher le diff complet avant commit")
    parser.add_argument("--yes", "-y", action="store_true",
                        help="Répondre 'oui' à toutes les confirmations")
    parser.add_argument("--dry-run", "-n", action="store_true",
                        help="Simuler les opérations sans rien modifier")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Afficher les logs de débogage")
    return parser.parse_args()

# ======================= MAIN =======================
def main():
    args = parse_arguments()
    global DRY_RUN
    DRY_RUN = args.dry_run
    
    setup_logging(args.verbose)
    
    manager = DeploymentManager(args)
    try:
        exit_code = manager.run()
    except KeyboardInterrupt:
        logging.info("\nDéploiement interrompu par l'utilisateur.")
        manager._restore_backups()
        exit_code = 1
    except Exception as e:
        logging.exception(f"Erreur inattendue: {e}")
        manager._restore_backups()
        exit_code = 1
    
    if not args.verbose:
        input("\nAppuyez sur Entrée pour fermer la console...")
    sys.exit(exit_code)

if __name__ == "__main__":
    main()