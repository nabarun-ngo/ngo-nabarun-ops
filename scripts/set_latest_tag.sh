#!/usr/bin/env bash
set -euo pipefail

# Updated script for Setup-Env workflow integration
# This script fetches the latest tags for FE and BE repositories

echo "🚀 Fetching latest repository tags..."

# Repository configurations
FE_REPO="nabarun-ngo/ngo-nabarun-fe"
BE_REPO="nabarun-ngo/ngo-nabarun-be"

# Get target environment from existing variables or default to dev
TARGET_ENV="${target_env:-${environment:-dev}}"
echo "📊 Target environment: $TARGET_ENV"

# Determine branch based on environment
if [[ "$TARGET_ENV" == "prod" ]]; then
  BRANCH="master"
else
  BRANCH="stage"
fi

echo "📝 Using branch: $BRANCH for environment: $TARGET_ENV"

# Set branch information as script outputs
export SCRIPT_TARGET_BRANCH="$BRANCH"
export SCRIPT_ENVIRONMENT_RESOLVED="$TARGET_ENV"

# Function: get_latest_tag <repo> <branch>
get_latest_tag() {
  local repo="$1"
  local branch="$2"
  
  echo "🔍 Fetching latest tag for $repo on branch $branch..."

  local tmp_dir
  tmp_dir=$(mktemp -d)
  trap 'rm -rf "$tmp_dir"' RETURN

  cd "$tmp_dir"

  git init -q
  git remote add origin "https://github.com/${repo}.git"
  
  # Fetch tags and branch
  if ! git fetch --tags --depth=1 origin "$branch" 2>/dev/null; then
    echo "❌ Failed to fetch from $repo branch $branch" >&2
    return 1
  fi

  # Get the latest tag that's merged into the branch
  local latest_tag
  latest_tag=$(git tag --sort=-creatordate --merged "origin/$branch" | head -n1)

  if [[ -z "$latest_tag" ]]; then
    echo "❌ No tag found on branch $branch in $repo" >&2
    return 1
  fi

  echo "$latest_tag"
}

# Initialize tag variables
FE_TAG=""
BE_TAG=""

# Fetch FE tag if needed
FE_TAG_INPUT="${fe_tag_name:-}"
if [[ -z "$FE_TAG_INPUT" || "$FE_TAG_INPUT" == "latest" ]]; then
  echo "🔄 Fetching latest FE tag..."
  if FE_TAG=$(get_latest_tag "$FE_REPO" "$BRANCH"); then
    echo "✅ Frontend tag: $FE_TAG"
    export SCRIPT_FE_TAG_NAME="$FE_TAG"
    export SCRIPT_FE_TAG_FETCHED=true
    
    # Also set in GITHUB_ENV if available (backward compatibility)
    [[ -n "${GITHUB_ENV:-}" ]] && echo "fe_tag_name=$FE_TAG" >> "$GITHUB_ENV"
  else
    echo "❌ Failed to fetch FE tag"
    export SCRIPT_FE_TAG_FETCHED=false
    export SCRIPT_FE_TAG_ERROR="Failed to fetch latest tag"
  fi
else
  echo "ℹ️ Using provided FE tag: $FE_TAG_INPUT"
  export SCRIPT_FE_TAG_NAME="$FE_TAG_INPUT"
  export SCRIPT_FE_TAG_FETCHED=false
  FE_TAG="$FE_TAG_INPUT"
fi

# Fetch BE tag if needed  
BE_TAG_INPUT="${be_tag_name:-}"
if [[ -z "$BE_TAG_INPUT" || "$BE_TAG_INPUT" == "latest" ]]; then
  echo "🔄 Fetching latest BE tag..."
  if BE_TAG=$(get_latest_tag "$BE_REPO" "$BRANCH"); then
    echo "✅ Backend tag: $BE_TAG"
    export SCRIPT_BE_TAG_NAME="$BE_TAG"
    export SCRIPT_BE_TAG_FETCHED=true
    
    # Also set in GITHUB_ENV if available (backward compatibility)
    [[ -n "${GITHUB_ENV:-}" ]] && echo "be_tag_name=$BE_TAG" >> "$GITHUB_ENV"
  else
    echo "❌ Failed to fetch BE tag"
    export SCRIPT_BE_TAG_FETCHED=false
    export SCRIPT_BE_TAG_ERROR="Failed to fetch latest tag"
  fi
else
  echo "ℹ️ Using provided BE tag: $BE_TAG_INPUT"
  export SCRIPT_BE_TAG_NAME="$BE_TAG_INPUT"
  export SCRIPT_BE_TAG_FETCHED=false
  BE_TAG="$BE_TAG_INPUT"
fi

# Set additional metadata
export SCRIPT_SCRIPT_EXECUTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
export SCRIPT_REPOSITORIES_PROCESSED=2

# Output summary JSON with deployment information
echo "### JSON_OUTPUT_START ###"
cat << EOF
{
  "deployment_info": {
    "frontend": {
      "repository": "$FE_REPO",
      "tag": "${FE_TAG:-unknown}",
      "branch_used": "$BRANCH",
      "tag_fetched": $([ "${SCRIPT_FE_TAG_FETCHED:-false}" = "true" ] && echo true || echo false)
    },
    "backend": {
      "repository": "$BE_REPO", 
      "tag": "${BE_TAG:-unknown}",
      "branch_used": "$BRANCH",
      "tag_fetched": $([ "${SCRIPT_BE_TAG_FETCHED:-false}" = "true" ] && echo true || echo false)
    }
  },
  "deployment_metadata": {
    "target_environment": "$TARGET_ENV",
    "source_branch": "$BRANCH",
    "deployment_ready": $([ -n "$FE_TAG" ] && [ -n "$BE_TAG" ] && echo true || echo false),
    "execution_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  }
}
EOF
echo "### JSON_OUTPUT_END ###"

# Final summary
echo ""
echo "📋 Tag Resolution Summary:"
echo "  Environment: $TARGET_ENV"
echo "  Branch: $BRANCH"
echo "  Frontend Tag: ${FE_TAG:-not-resolved}"
echo "  Backend Tag: ${BE_TAG:-not-resolved}"

# Set exit code based on success
if [[ -n "${FE_TAG:-}" && -n "${BE_TAG:-}" ]]; then
  echo "✅ All tags resolved successfully!"
  exit 0
else
  echo "⚠️ Some tags could not be resolved"
  exit 0  # Don't fail the workflow, let the consumer decide
fi
