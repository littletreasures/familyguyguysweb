#!/bin/bash
# run-daemon.sh - background sync daemon

REPO_DIR="/Volumes/RetroSSD/SSD-Family-Guy-Guys-Storage/FamilyGuyWebsite"
cd "$REPO_DIR" || exit 1

echo "Starting Antigravity Sync Daemon..."
echo "Polling origin/main every 60s..."

while true; do
  # Fetch latest references
  if git fetch origin main > /dev/null 2>&1; then
    LOCAL=$(git rev-parse HEAD 2>/dev/null)
    REMOTE=$(git rev-parse origin/main 2>/dev/null)
    
    if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
      echo "$(date '+%Y-%m-%d %H:%M:%S') - Remote updates detected! Local: $LOCAL, Remote: $REMOTE"
      
      # 1. Pre-sync hook: stash changes
      echo "Running pre-sync: git stash -u..."
      git stash -u
      
      # 2. Sync: rebase onto origin/main
      echo "Rebasing onto origin/main..."
      if git rebase origin/main; then
        # 3. Post-sync-resolve: pop stash
        echo "Running post-sync-resolve: git stash pop..."
        git stash pop || true
        
        # 4. Post-sync hooks
        echo "Running post-sync hooks..."
        npm install
        bash .antigravity/scripts/sync-context.sh
        
        echo "Sync complete."
      else
        echo "Rebase failed. Aborting sync."
        git rebase --abort
        git stash pop || true
      fi
    fi
  else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - git fetch failed (network or auth issue), retrying in next cycle..."
  fi
  
  sleep 60
done
