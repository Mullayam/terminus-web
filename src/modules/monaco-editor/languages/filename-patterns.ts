/**
 * @module monaco-editor/languages/filename-patterns
 *
 * Shared filename pattern matchers for special files
 * (Dockerfile, docker-compose, etc.) that need custom handling
 * across icon, language-detection, and badge layers.
 */

/**
 * Matches Dockerfile variants:
 *   Dockerfile, dockerfile, Dockerfile.dev, Dockerfile.prod,
 *   Dockerfile.staging, dockerfile.test, etc.
 */
const DOCKERFILE_RE = /^dockerfile(?:\..+)?$/i;

/**
 * Matches docker-compose variants:
 *   docker-compose.yml, docker-compose.yaml,
 *   docker-compose.dev.yml, docker-compose.override.yml, etc.
 */
const DOCKER_COMPOSE_RE = /^docker-compose(?:\..+)?\.ya?ml$/i;

/**
 * Check whether a filename is a Dockerfile (including variants like Dockerfile.dev).
 */
export function isDockerfile(fileName: string): boolean {
  const base = (fileName.split(/[/\\]/).pop() ?? fileName).trim();
  return DOCKERFILE_RE.test(base);
}

/**
 * Check whether a filename is a docker-compose file.
 */
export function isDockerCompose(fileName: string): boolean {
  const base = (fileName.split(/[/\\]/).pop() ?? fileName).trim();
  return DOCKER_COMPOSE_RE.test(base);
}

/**
 * Check whether a filename is any Docker-related file.
 */
export function isDockerFile(fileName: string): boolean {
  return isDockerfile(fileName) || isDockerCompose(fileName);
}
