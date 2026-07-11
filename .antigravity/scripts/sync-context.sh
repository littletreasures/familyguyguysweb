#!/bin/bash
set -e

WORKSPACE_ROOT="$(git rev-parse --show-toplevel)"
LOCAL_AGENTS_DIR="$WORKSPACE_ROOT/.agents"
LOCAL_AGENTS_FILE="$LOCAL_AGENTS_DIR/AGENTS.md"
OBSIDIAN_TARGET="/Users/jrhackett/Obsidian Vault/Second Brain/Agents/AGENTS.md"

echo "Running post-sync context routing..."

# 1. Ensure .agents directory exists
mkdir -p "$LOCAL_AGENTS_DIR"

# Ensure the local AGENTS.md file exists so we can symlink it
if [ ! -f "$LOCAL_AGENTS_FILE" ]; then
    echo "# Agent Context Log - familyguyguysweb" > "$LOCAL_AGENTS_FILE"
    echo "Initialized context log under Interpretable Context Methodology (ICM)." >> "$LOCAL_AGENTS_FILE"
fi

# 2. Append JULES.md content to local AGENTS.md if it exists
if [ -f "$WORKSPACE_ROOT/JULES.md" ]; then
    echo "Processing JULES.md and appending to local AGENTS.md..."
    
    # Format entry using Interpretable Context Methodology (ICM)
    echo "" >> "$LOCAL_AGENTS_FILE"
    echo "---" >> "$LOCAL_AGENTS_FILE"
    echo "### Sync Entry: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOCAL_AGENTS_FILE"
    echo "**Source:** Jules Cloud Agent Sync" >> "$LOCAL_AGENTS_FILE"
    echo "" >> "$LOCAL_AGENTS_FILE"
    cat "$WORKSPACE_ROOT/JULES.md" >> "$LOCAL_AGENTS_FILE"
    echo "" >> "$LOCAL_AGENTS_FILE"
else
    echo "No JULES.md found in workspace root."
fi

# 3. Create / update the symlink to the Obsidian Vault
if [ ! -L "$OBSIDIAN_TARGET" ]; then
    if [ -f "$OBSIDIAN_TARGET" ]; then
        echo "Found existing file at Obsidian target. Backing up..."
        mv "$OBSIDIAN_TARGET" "${OBSIDIAN_TARGET}.bak"
    fi
    ln -sf "$LOCAL_AGENTS_FILE" "$OBSIDIAN_TARGET"
    echo "Symlinked $LOCAL_AGENTS_FILE to $OBSIDIAN_TARGET"
else
    echo "Symlink to Obsidian Vault already exists."
fi

echo "Post-sync context routing complete."
