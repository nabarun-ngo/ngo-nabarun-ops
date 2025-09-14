#!/usr/bin/env bash
set -euo pipefail

FE_REPO="nabarun-ngo/ngo-nabarun-fe"
BE_REPO="nabarun-ngo/ngo-nabarun-be"

# Determine branch based on environment
if [[ "$target_env" == "prod" ]]; then
  BRANCH="master"
else
  BRANCH="stage"
fi

# Function: get_latest_tag <repo> <branch>
get_latest_tag() {
  local repo="$1"
  local branch="$2"

  local tmp_dir
  tmp_dir=$(mktemp -d)
  trap 'rm -rf "$tmp_dir"' RETURN

  cd "$tmp_dir"

  git init -q
  git remote add origin "https://github.com/${repo}.git"
  git fetch --tags --depth=1 origin "$branch"

  local latest_tag
  latest_tag=$(git tag --sort=-creatordate --merged "origin/$branch" | tail -n1)

  if [[ -z "$latest_tag" ]]; then
    echo "❌ No tag found on branch $branch in $repo" >&2
    return 1
  fi

  echo "$latest_tag"
}

# Only fetch FE_TAG if not already set
if [[ "${fe_tag_name}" == "latest" ]]; then
  FE_TAG=$(get_latest_tag "$FE_REPO" "$BRANCH")
  [[ -n "${GITHUB_ENV:-}" ]] && echo "fe_tag_name=$FE_TAG" >> "$GITHUB_ENV"
 echo "✅ fe_tag_name=$FE_TAG" 
fi

# Only fetch BE_TAG if not already set
if [[ "${be_tag_name}" == "latest" ]]; then
  BE_TAG=$(get_latest_tag "$BE_REPO" "$BRANCH")
  [[ -n "${GITHUB_ENV:-}" ]] && echo "be_tag_name=$BE_TAG" >> "$GITHUB_ENV"
  echo "✅ be_tag_name=$BE_TAG"
fi

