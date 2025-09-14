#!/bin/bash
# This script computes the 'run_name', and sets it as a GitHub Actions env variable and output.
# Assumes all values are already available as lowercase environment variables.

# Expected env vars: pr_number, target_env, fe_tag_name, be_tag_name
# If pr_number is not set or empty, skip it

RUN_NAME=""
if [ -n "$pr_number" ]; then
    RUN_NAME="#${pr_number} "
fi
RUN_NAME="${RUN_NAME}Deploying to ${target_env} — FE:${fe_tag_name} BE:${be_tag_name}"

# Set as GitHub env and output
if [ -n "$GITHUB_ENV" ]; then
  echo "RUN_NAME=${RUN_NAME}" >> "$GITHUB_ENV"
fi
if [ -n "$GITHUB_OUTPUT" ]; then
  echo "run_name=${RUN_NAME}" >> "$GITHUB_OUTPUT"
fi

echo "Run name set: $RUN_NAME"
