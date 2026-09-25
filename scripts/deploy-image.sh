#!/usr/bin/env bash
set -euo pipefail

IMAGE=${1:-}
SHA=${2:-}
APP_DIR=${DEPLOY_APP_DIR:-"$HOME/lop-dashboard"}
PROJECT=${DEPLOY_PROJECT:-lop-dashboard}
HEALTH_URL_OVERRIDE=${DEPLOY_HEALTH_URL:-}
EXPECTED_IMAGE_PREFIX=ghcr.io/hafizsantosa/branch-focus-dashboard@sha256:

fail() {
  printf 'Deployment refused: %s\n' "$*" >&2
  exit 1
}

[[ "$IMAGE" =~ ^ghcr\.io/hafizsantosa/branch-focus-dashboard@sha256:[0-9a-f]{64}$ ]] || fail 'invalid immutable GHCR image reference'
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail 'invalid full Git commit SHA'
[[ "$IMAGE" == "$EXPECTED_IMAGE_PREFIX"* ]] || fail 'image repository is not approved'
[[ -d "$APP_DIR/.git" ]] || fail "checkout not found at $APP_DIR"
[[ -f "$APP_DIR/.env" ]] || fail "required environment file missing at $APP_DIR/.env"
command -v docker >/dev/null || fail 'Docker is not installed'
docker compose version >/dev/null 2>&1 || fail 'Docker Compose plugin is not installed'

cd "$APP_DIR"
git diff --quiet && git diff --cached --quiet || fail 'tracked checkout modifications would be overwritten'

COMPOSE=(docker compose --project-name "$PROJECT")
APP_CONTAINER=lop-priority-app
if docker container inspect "$APP_CONTAINER" >/dev/null 2>&1; then
  PROJECT_LABEL=$(docker inspect "$APP_CONTAINER" --format '{{index .Config.Labels "com.docker.compose.project"}}')
  [[ "$PROJECT_LABEL" == "$PROJECT" ]] || fail "container belongs to Compose project '$PROJECT_LABEL', expected '$PROJECT'"
  [[ "$(docker inspect "$APP_CONTAINER" --format '{{.State.Running}}')" == true ]] || fail 'existing app container is not running'
  PREVIOUS_IMAGE=$(docker inspect "$APP_CONTAINER" --format '{{.Config.Image}}')
  [[ -n "$PREVIOUS_IMAGE" ]] || fail 'could not determine previous image for rollback'
  EXISTING_INSTALL=true
else
  EXISTING_INSTALL=false
  if docker volume inspect "${PROJECT}_app-data" >/dev/null 2>&1; then
    fail "volume ${PROJECT}_app-data exists without the app container; examine its owner and state before deployment"
  fi
fi

# Pull before changing the checkout or service. Never prune images: rollback depends on the prior one.
docker pull "$IMAGE"
git fetch --quiet origin main
if [[ "$(git rev-parse origin/main)" != "$SHA" ]]; then
  printf 'Skipping superseded deployment for %s; origin/main has advanced.\n' "$SHA"
  exit 0
fi

git switch --detach "$SHA"
export APP_IMAGE="$IMAGE"
"${COMPOSE[@]}" config --quiet

health_url() {
  if [[ -n "$HEALTH_URL_OVERRIDE" ]]; then
    printf '%s\n' "$HEALTH_URL_OVERRIDE"
    return
  fi
  local published
  published=$("${COMPOSE[@]}" port app 3000) || return 1
  [[ -n "$published" ]] || return 1
  printf 'http://%s/api/health\n' "$published"
}

wait_health() {
  local url=$1
  local attempt
  for attempt in {1..30}; do
    if curl --fail --silent --show-error "$url"; then
      printf '\n'
      return 0
    fi
    sleep 2
  done
  return 1
}

rollout() {
  "${COMPOSE[@]}" up -d --no-build --pull never --wait --wait-timeout 180 app
  local url
  url=$(health_url)
  wait_health "$url"
}

if rollout; then
  printf 'Deployment healthy: %s (%s)\n' "$IMAGE" "$SHA"
  exit 0
fi

printf 'Deployment or application health check failed for %s.\n' "$IMAGE" >&2
"${COMPOSE[@]}" ps >&2 || true
docker logs --tail 100 "$APP_CONTAINER" >&2 || true
if [[ "$EXISTING_INSTALL" == true ]]; then
  printf 'Rolling back to previous image %s.\n' "$PREVIOUS_IMAGE" >&2
  export APP_IMAGE="$PREVIOUS_IMAGE"
  if "${COMPOSE[@]}" up -d --no-build --pull never --wait --wait-timeout 180 app; then
    rollback_url=$(health_url) || rollback_url=
    if [[ -n "$rollback_url" ]] && wait_health "$rollback_url"; then
      printf 'Rollback is healthy; deployment remains failed.\n' >&2
    else
      printf 'Rollback health check failed; inspect the service immediately.\n' >&2
    fi
  else
    printf 'Rollback command failed; inspect the service immediately.\n' >&2
  fi
else
  printf 'Fresh installation failed; its volume was retained for diagnosis.\n' >&2
fi
exit 1
