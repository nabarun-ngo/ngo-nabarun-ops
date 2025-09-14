# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository Overview

This repository contains **NGO Nabarun's GitHub Actions orchestration workflows** for managing deployments, testing, and data synchronization across multiple environments (stage/prod). It serves as the central operations hub that coordinates deployments of Angular frontend and Spring Boot backend applications.

### Core Architecture

The repository follows a **workflow orchestration pattern** where this ops repository triggers and coordinates deployments across multiple service repositories:

**Key Components:**
- **Deploy Workflow**: `deploy.yml` - Orchestrates frontend (Firebase) and backend (GCP App Engine) deployments
- **Test Workflow**: `test.yml` - Manages automated smoke and regression testing
- **Data Sync Workflow**: `sync-import-data.yml` - Handles Auth0 tenant and Firebase remote config synchronization
- **Utility Workflows**: GCP log extraction and Redis cache management
- **Helper Scripts**: Bash scripts for generating dynamic workflow names

### Multi-Repository Architecture

This operations repository coordinates deployments across:
- **Frontend Repository**: `nabarun-ngo/ngo-nabarun-fe` (Angular application)
- **Backend Repository**: `nabarun-ngo/ngo-nabarun-be` (Spring Boot application)
- **Template Repository**: `nabarun-ngo/ngo-nabarun-templates` (Reusable GitHub Actions workflows)

### Environment Strategy

**Stage Environment:**
- Used for development testing and validation
- Firebase hosting with staging configuration
- GCP App Engine staging service
- Auth0 staging tenant

**Production Environment:**
- Live production deployment
- Firebase hosting with production configuration
- GCP App Engine production service
- Auth0 production tenant with enhanced security

## Common Development Tasks

### Triggering Deployments

**Manual Deployments (via GitHub UI):**
```powershell
# Deploy both frontend and backend to staging
# Navigate to Actions tab -> "[Deploy] Deploy, Sync and Test Applications"
# Set parameters:
# - fe_deploy: true
# - fe_tag_name: v1.2.0
# - be_deploy: true
# - be_tag_name: v1.1.5
# - target_env: stage
```

**API-Triggered Deployments:**
```powershell
# Trigger full deployment via repository dispatch
gh api repos/nabarun-ngo/ngo-nabarun-ops/dispatches \
  --method POST \
  --field event_type='Trigger-Deploy-Sync-Test' \
  --field 'client_payload={"fe_deploy":true,"fe_tag_name":"v1.2.0","be_deploy":true,"be_tag_name":"v1.1.5","target_env":"stage","run_smoke_test":true}'

# Trigger frontend-only deployment
gh api repos/nabarun-ngo/ngo-nabarun-ops/dispatches \
  --method POST \
  --field event_type='Trigger-DeployFE-Sync-Test' \
  --field 'client_payload={"fe_tag_name":"v1.3.0","target_env":"stage"}'

# Trigger backend-only deployment
gh api repos/nabarun-ngo/ngo-nabarun-ops/dispatches \
  --method POST \
  --field event_type='Trigger-DeployBE-Sync-Test' \
  --field 'client_payload={"be_tag_name":"v1.2.1","target_env":"prod"}'
```

### Running Tests

**Smoke Tests:**
```powershell
# Trigger smoke tests via workflow dispatch
gh workflow run test.yml \
  --repo nabarun-ngo/ngo-nabarun-ops \
  -f test_env=stage \
  -f test_type=Smoke \
  -f test_filter_tag_smoke='@smoke'

# Production smoke tests (uses different tags)
gh workflow run test.yml \
  --repo nabarun-ngo/ngo-nabarun-ops \
  -f test_env=stage \
  -f test_type=Smoke \
  -f test_filter_tag_smoke='@smokeprod'
```

**Regression Tests:**
```powershell
# Full regression test suite
gh workflow run test.yml \
  --repo nabarun-ngo/ngo-nabarun-ops \
  -f test_env=stage \
  -f test_type=Regression \
  -f test_filter_tag_regression='@regression'
```

### Data Synchronization

**Auth0 Tenant Sync:**
```powershell
# Sync from STAGE to PROD tenant
gh workflow run sync-import-data.yml \
  --repo nabarun-ngo/ngo-nabarun-ops \
  -f auth0_sync_tenant=true \
  -f auth0_source_tenant=STAGE \
  -f auth0_dest_tenant=PROD

# Sync from DEV to STAGE tenant
gh workflow run sync-import-data.yml \
  --repo nabarun-ngo/ngo-nabarun-ops \
  -f auth0_sync_tenant=true \
  -f auth0_source_tenant=DEV \
  -f auth0_dest_tenant=STAGE
```

**Firebase Remote Config Sync:**
```powershell
# Sync Firebase config from STAGE to PROD
gh workflow run sync-import-data.yml \
  --repo nabarun-ngo/ngo-nabarun-ops \
  -f firebase_sync_rc=true \
  -f firebase_source_env=STAGE \
  -f firebase_dest_env=PROD
```

### Utility Operations

**GCP Log Extraction:**
```powershell
# Download logs for specific UUID in HTML format
gh workflow run GCP-Logs.yml \
  --repo nabarun-ngo/ngo-nabarun-ops \
  -f uuid='12345678-abcd-1234-efgh-123456789abc' \
  -f environment=stage \
  -f output_type=html
```

**Redis Cache Management:**
```powershell
# View all Redis keys
gh workflow run cache.yml \
  --repo nabarun-ngo/ngo-nabarun-ops \
  -f action=view

# Delete specific Redis key
gh workflow run cache.yml \
  --repo nabarun-ngo/ngo-nabarun-ops \
  -f action=delete \
  -f key='user:session:12345'

# Test Redis connectivity
gh workflow run cache.yml \
  --repo nabarun-ngo/ngo-nabarun-ops \
  -f action=ping
```

### Working with Helper Scripts

**Understanding Script Functionality:**
```bash
# Review deploy script logic
cat scripts/set_run_name_deploy.sh

# Review sync script logic  
cat scripts/set_run_name_sync.sh

# Test script locally (requires environment variables)
export target_env="stage"
export fe_tag_name="v1.2.0"
export be_tag_name="v1.1.5"
./scripts/set_run_name_deploy.sh
```

## Key Development Patterns

### Workflow Orchestration Architecture

This repository implements a **central orchestration pattern**:
- **Coordination Hub**: This repository coordinates multi-service deployments
- **Reusable Templates**: Leverages `ngo-nabarun-templates` for common deployment patterns
- **Service Separation**: Frontend and backend deployments are independent but coordinated
- **Environment Consistency**: Same workflows work across stage/prod with parameter differences

### Dynamic Workflow Naming

The repository uses bash scripts to generate meaningful workflow run names:
```bash
# Deploy workflow generates names like:
"#123 Deploying to stage — FE:v1.2.0 BE:v1.1.5"

# Sync workflow generates names like:
"Syncing Auth0 tenant from 'STAGE' to 'PROD'"
```

### Environment-Driven Configuration

**Environment Variables Pattern:**
- `target_env` determines deployment target (stage/prod)
- Environment-specific secrets and configurations
- Conditional logic based on environment (prod gets different Auth0 sync behavior)
- Different Firebase build commands per environment

### Repository Dispatch Integration

**Cross-Repository Communication:**
- Uses `repository_dispatch` events for loose coupling between repositories
- Supports both automated CI/CD triggers and manual orchestration
- Payload-based parameter passing for flexible deployments

### Test Automation Integration

**Testing Strategy:**
- Smoke tests run after deployments automatically
- Regression tests run on schedule (weekly)
- Test parallelization with configurable matrix size
- Qmetry integration for test result reporting
- Environment-specific test tags (@smoke vs @smokeprod)

## Integration Points

### Template Repository Dependencies

This repository heavily relies on reusable workflows from `nabarun-ngo/ngo-nabarun-templates`:
- `Setup-Env.yml` - Environment setup and variable processing
- `Deploy-Firebase.yml` - Angular frontend deployment to Firebase
- `Deploy-GCP.yml` - Spring Boot backend deployment to GCP App Engine
- `Run-Parallel-Tests.yml` - Automated testing execution
- `Trigger-Workflow.yml` - Cross-repository workflow triggering
- `Sync-Auth0-v2.yml` - Auth0 tenant synchronization (currently disabled)
- `Firebase-Sync-v2.yml` - Firebase remote config sync (currently disabled)

### Secret Management Strategy

**Repository Secrets Required:**
```bash
# Authentication
PAT                              # Personal Access Token for cross-repo access
GITHUB_TOKEN                     # GitHub token for API access

# Firebase Integration  
FB_SA_KEY                        # Firebase service account key
FB_SA_KEY_STAGE                  # Staging Firebase service account
FB_SA_KEY_PROD                   # Production Firebase service account
FB_SA_KEY_DEV                    # Development Firebase service account

# GCP Integration
GCP_SA_KEY                       # GCP service account key for App Engine deployment

# Auth0 Integration
AUTH0_CONFIG_STAGE               # Auth0 staging tenant configuration
AUTH0_CONFIG_DEV                 # Auth0 development tenant configuration

# Testing Integration
DOPPLER_TOKEN_NABARUN_BACKEND    # Backend configuration via Doppler
DOPPLER_TOKEN_NABARUN_TESTS      # Test configuration via Doppler
QMETRY_APIKEY                    # QMetry test management API key
QMETRY_OPEN_APIKEY               # QMetry open API key

# Cache Management
REDIS_HOST                       # Redis server host
REDIS_PORT                       # Redis server port  
REDIS_PASSWORD                   # Redis authentication password
```

**Repository Variables Required:**
```bash
# Project Configuration
FB_PROJECT_ID                    # Main Firebase project ID
FB_PROJECT_ID_STAGE              # Staging Firebase project ID
FB_PROJECT_ID_PROD               # Production Firebase project ID
FB_PROJECT_ID_DEV                # Development Firebase project ID
GCP_PROJECT_ID                   # Google Cloud project ID
GCP_LOG_LEVEL                    # Logging level for GCP deployments
```

### Cross-Repository Workflow Triggers

**Automatic Triggering Pattern:**
1. Deploy workflow completes successfully
2. Triggers `Trigger-Import-Sync-Data` if sync is enabled
3. Triggers `Trigger-Smoke-Test` in appropriate test repository
4. Test repository determined by environment (prod uses `ngo-nabarun-prodops`)

**Repository Routing Logic:**
```yaml
# Staging tests
repository: 'nabarun-ngo/ngo-nabarun-ops'

# Production tests  
repository: 'nabarun-ngo/ngo-nabarun-prodops'
```

## Troubleshooting Common Issues

### Deployment Failures

**Frontend Deployment Issues:**
- Check Firebase service account permissions
- Verify `fe_tag_name` exists in frontend repository
- Ensure Firebase project ID matches environment
- Check build command configuration (`npm ci --legacy-peer-deps`)

**Backend Deployment Issues:**
- Verify GCP service account has App Engine deployment permissions
- Check `be_tag_name` exists in backend repository
- Ensure Doppler token has access to required secrets
- Verify App Engine service configuration

### Test Execution Failures

**Common Test Issues:**
- Verify Doppler configuration for test environment
- Check Cucumber tag syntax (`@smoke`, `@regression`)
- Ensure QMetry API keys are valid
- Check test environment URL accessibility

### Synchronization Problems

**Auth0 Sync Issues:**
- Note: Auth0 sync workflows are currently commented out
- Check tenant configuration secrets
- Verify source and destination tenant access

**Firebase Sync Issues:**
- Note: Firebase sync workflows are currently commented out
- Verify service account permissions for both projects
- Check project ID configuration

## Deployment Flow Understanding

### Standard Deployment Process

1. **Environment Setup** (`set_env` job)
   - Processes input parameters or repository dispatch payload
   - Generates dynamic workflow run name
   - Sets environment variables for subsequent jobs

2. **Frontend Deployment** (conditional - if `fe_deploy` is true)
   - Checks out specified tag from `ngo-nabarun-fe`
   - Builds Angular application with environment-specific configuration
   - Deploys to Firebase hosting using service account authentication

3. **Backend Deployment** (conditional - if `be_deploy` is true)
   - Checks out specified tag from `ngo-nabarun-be`
   - Builds Spring Boot application with Maven
   - Deploys to GCP App Engine using service account authentication
   - Configures Doppler for runtime secrets management

4. **Data Synchronization** (conditional)
   - Automatically runs for production deployments
   - Manually triggered based on `auth0_sync` parameter
   - Maintains configuration consistency across environments

5. **Smoke Testing** (conditional - if `run_smoke_test` is true)
   - Waits for deployment completion
   - Triggers appropriate test repository based on environment
   - Uses environment-specific test tags
   - Supports cancellation of running tests to prevent conflicts

### Error Handling and Recovery

**Deployment Failure Recovery:**
- Each deployment job is independent and can be retried
- Failed deployments don't block other services
- Smoke tests only run if at least one deployment succeeds

**Monitoring and Debugging:**
- `dump_needs_context` job provides detailed job result information
- Dynamic run names include version information for tracking
- GCP logs workflow provides detailed application logging

This orchestration pattern enables the NGO Nabarun organization to maintain consistent, reliable deployments across multiple environments while supporting both automated CI/CD processes and manual operational control.
