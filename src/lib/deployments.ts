/** Locally tracked GitHub-triggered deployments (browser storage). */

export interface DeploymentRecord {
  id: string;
  repoFullName: string;
  branch: string;
  commitSha?: string;
  mode: "CI_BUILD" | "CI_DEPLOY";
  jobId: number;
  jobName: string;
  requestedCores: number;
  requestedMemoryMb: number;
  estimatedMs: number;
  createdAt: number;
}

const KEY = "mvcc.deployments";

export function listDeployments(): DeploymentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as DeploymentRecord[]) : [];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.createdAt - a.createdAt) : [];
  } catch {
    return [];
  }
}

export function addDeployment(record: DeploymentRecord) {
  if (typeof window === "undefined") return;
  const next = [record, ...listDeployments()].slice(0, 50);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("mvcc-deployments"));
}

export function clearDeployments() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("mvcc-deployments"));
}
