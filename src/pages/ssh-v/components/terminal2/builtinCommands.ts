import type { CommandIndex, ArgCommandInfo } from "./arg-hint-bar";

/**
 * A small, offline set of common CLI flags/subcommands so the arg-hint bar is
 * useful before (or without) any context-engine command pack installed.
 * Installed packs merge on top of this and take precedence.
 */

function mk(
  name: string,
  options: string[],
  subcommands: Record<string, string[]> = {},
): ArgCommandInfo {
  const subs: ArgCommandInfo["subcommands"] = {};
  for (const [sub, opts] of Object.entries(subcommands)) subs[sub] = { options: opts };
  return { name, options, subcommands: subs };
}

const COMMON_HELP = ["--help", "-h"];

export const BUILTIN_COMMAND_INDEX: CommandIndex = {
  ls: mk("ls", ["-a", "-l", "-h", "-la", "-lh", "-R", "-t", "-S", "-r", "--all", ...COMMON_HELP]),
  cat: mk("cat", ["-n", "-b", "-A", "-E", ...COMMON_HELP]),
  grep: mk("grep", ["-i", "-r", "-R", "-n", "-v", "-E", "-l", "-c", "-w", "-o", "--color", "--include", "--exclude", ...COMMON_HELP]),
  find: mk("find", ["-name", "-iname", "-type", "-path", "-mtime", "-size", "-maxdepth", "-mindepth", "-exec", "-delete", ...COMMON_HELP]),
  rm: mk("rm", ["-r", "-f", "-rf", "-i", "-v", "-d", ...COMMON_HELP]),
  cp: mk("cp", ["-r", "-f", "-i", "-v", "-p", "-a", "-u", ...COMMON_HELP]),
  mv: mk("mv", ["-f", "-i", "-v", "-n", "-u", ...COMMON_HELP]),
  mkdir: mk("mkdir", ["-p", "-v", "-m", ...COMMON_HELP]),
  chmod: mk("chmod", ["-R", "-v", "-c", ...COMMON_HELP]),
  chown: mk("chown", ["-R", "-v", "-c", ...COMMON_HELP]),
  tar: mk("tar", ["-x", "-c", "-z", "-j", "-v", "-f", "-t", "--extract", "--create", "--gzip", "--file", "--exclude", ...COMMON_HELP]),
  kill: mk("kill", ["-9", "-15", "-1", "-l", "-s", ...COMMON_HELP]),
  ps: mk("ps", ["aux", "-e", "-f", "-ef", "-u", "-x", ...COMMON_HELP]),
  df: mk("df", ["-h", "-T", "-i", "-a", ...COMMON_HELP]),
  du: mk("du", ["-h", "-s", "-a", "-c", "--max-depth", ...COMMON_HELP]),
  tail: mk("tail", ["-f", "-n", "-c", ...COMMON_HELP]),
  head: mk("head", ["-n", "-c", ...COMMON_HELP]),
  ssh: mk("ssh", ["-p", "-i", "-L", "-R", "-D", "-N", "-f", "-v", "-C", ...COMMON_HELP]),
  scp: mk("scp", ["-r", "-P", "-i", "-p", "-C", ...COMMON_HELP]),
  curl: mk("curl", ["-X", "-H", "-d", "-o", "-O", "-L", "-s", "-I", "-k", "-u", "-A", ...COMMON_HELP]),
  wget: mk("wget", ["-O", "-o", "-c", "-q", "-r", "--no-check-certificate", ...COMMON_HELP]),
  ping: mk("ping", ["-c", "-i", "-w", "-s", ...COMMON_HELP]),
  git: mk("git", ["--version", ...COMMON_HELP], {
    clone: ["--depth", "--branch", "-b", "--recursive", "--bare"],
    init: ["--bare"],
    add: ["-A", "-p", "-u", "--all"],
    commit: ["-m", "-a", "-am", "--amend", "--no-edit", "-S"],
    push: ["-u", "--force", "-f", "--tags", "--set-upstream", "--delete"],
    pull: ["--rebase", "--ff-only", "--no-edit"],
    fetch: ["--all", "--prune", "--tags"],
    status: ["-s", "-b", "--short"],
    log: ["--oneline", "--graph", "--stat", "-p", "-n", "--all"],
    branch: ["-a", "-r", "-d", "-D", "-m", "-v", "--merged"],
    checkout: ["-b", "-B", "-f", "--track"],
    switch: ["-c", "-C", "--detach"],
    merge: ["--no-ff", "--squash", "--abort", "--continue"],
    reset: ["--soft", "--hard", "--mixed"],
    rebase: ["-i", "--onto", "--abort", "--continue", "--skip"],
    stash: ["push", "pop", "list", "apply", "drop", "clear"],
    diff: ["--staged", "--cached", "--stat", "--name-only"],
    remote: ["-v", "add", "remove", "rename", "set-url"],
    tag: ["-a", "-d", "-l", "-m"],
  }),
  docker: mk("docker", [...COMMON_HELP], {
    run: ["-d", "-it", "-p", "-v", "-e", "--name", "--rm", "--network", "--restart"],
    ps: ["-a", "-q", "--filter", "--format"],
    images: ["-a", "-q", "--filter"],
    build: ["-t", "-f", "--no-cache", "--build-arg"],
    pull: ["--platform", "-a"],
    push: ["-a"],
    exec: ["-it", "-d", "-e", "-u", "-w"],
    logs: ["-f", "--tail", "-t", "--since"],
    stop: ["-t"],
    rm: ["-f", "-v"],
    rmi: ["-f"],
    compose: ["up", "down", "ps", "logs", "build", "restart", "exec"],
    network: ["ls", "create", "rm", "inspect"],
    volume: ["ls", "create", "rm", "inspect", "prune"],
  }),
  systemctl: mk("systemctl", [...COMMON_HELP], {
    start: [], stop: [], restart: [], reload: [], status: ["-l", "--no-pager"],
    enable: ["--now"], disable: ["--now"], "is-active": [], "is-enabled": [],
    "daemon-reload": [], list: [], "list-units": [], "list-unit-files": [],
  }),
  npm: mk("npm", ["-g", "-v", "--version", ...COMMON_HELP], {
    install: ["-g", "-D", "--save-dev", "--save", "--global", "--force", "--legacy-peer-deps"],
    i: ["-g", "-D", "--save-dev"],
    run: [], start: [], test: [], build: [], init: ["-y"],
    publish: ["--access", "--tag"], update: ["-g"], uninstall: ["-g"],
    ci: [], audit: ["fix"], link: [], exec: [],
  }),
  yarn: mk("yarn", [...COMMON_HELP], {
    install: ["--frozen-lockfile", "--production"],
    add: ["-D", "--dev", "-P", "--peer", "-E", "--exact"],
    remove: [], run: [], build: [], start: [], test: [], upgrade: [], global: ["add", "remove"],
  }),
  pnpm: mk("pnpm", [...COMMON_HELP], {
    install: ["--frozen-lockfile", "--prod"],
    add: ["-D", "--save-dev", "-g", "--global"],
    remove: [], run: [], build: [], start: [], test: [], update: [], dlx: [],
  }),
  pm2: mk("pm2", [...COMMON_HELP], {
    start: ["--name", "-i", "--watch"], stop: [], restart: [], reload: [],
    delete: [], list: [], logs: ["--lines"], monit: [], save: [], startup: [], flush: [],
  }),
  apt: mk("apt", ["-y", ...COMMON_HELP], {
    install: ["-y", "--no-install-recommends"], update: [], upgrade: ["-y"],
    remove: ["-y"], purge: ["-y"], search: [], show: [], autoremove: ["-y"], list: ["--installed", "--upgradable"],
  }),
  "apt-get": mk("apt-get", ["-y", ...COMMON_HELP], {
    install: ["-y"], update: [], upgrade: ["-y"], remove: ["-y"], purge: ["-y"], autoremove: ["-y"], clean: [],
  }),
  ip: mk("ip", [...COMMON_HELP], {
    addr: ["show", "add", "del"], link: ["show", "set"], route: ["show", "add", "del"], neigh: ["show"],
  }),
};
