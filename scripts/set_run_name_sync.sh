#!/bin/bash
# This script computes the 'run_name', and sets it as a GitHub Actions env variable and output.
# Assumes all values are already available as lowercase environment variables.

# Expected env vars: auth0_sync_tenant, auth0_source_tenant, auth0_dest_tenant, be_tag_name
# firebase_sync_rc, firebase_source_env, firebase_dest_env
# If none are set, default to a generic name

RUN_NAME="Syncing Data"
if [ -n "$auth0_sync_tenant" ]; then
    RUN_NAME="Syncing Auth0 tenant from '${auth0_source_tenant}' to '${auth0_dest_tenant}'"
fi

if [ -n "$firebase_sync_rc" ]; then
    RUN_NAME="Syncing Auth0 tenant from '${firebase_source_env}' to '${firebase_dest_env}'"
fi
# Set as GitHub env and output
if [ -n "$GITHUB_ENV" ]; then
  echo "RUN_NAME=${RUN_NAME}" >> "$GITHUB_ENV"
fi
if [ -n "$GITHUB_OUTPUT" ]; then
  echo "run_name=${RUN_NAME}" >> "$GITHUB_OUTPUT"
fi

echo "Run name set: $RUN_NAME"
