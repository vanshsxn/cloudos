/** Real workload catalogue used by the Submit Job form and GitHub launcher. */

export interface WorkloadType {
  id: string;
  label: string;
  description: string;
  /** Base cores / memory (MB) / runtime (ms) for a "Medium" sized run. */
  cores: number;
  memoryMb: number;
  estimatedMs: number;
}

export const WORKLOAD_TYPES: WorkloadType[] = [
  {
    id: "DATA_PROCESSING",
    label: "Data processing",
    description: "ETL / batch transforms over datasets",
    cores: 4,
    memoryMb: 1024,
    estimatedMs: 4000,
  },
  {
    id: "ML_TRAINING",
    label: "ML training",
    description: "Model training, heavy CPU and memory",
    cores: 8,
    memoryMb: 4096,
    estimatedMs: 12000,
  },
  {
    id: "VIDEO_ENCODING",
    label: "Video encoding",
    description: "Transcoding pipelines, CPU bound",
    cores: 6,
    memoryMb: 2048,
    estimatedMs: 8000,
  },
  {
    id: "REPORT_GENERATION",
    label: "Report generation",
    description: "Scheduled analytics and exports",
    cores: 2,
    memoryMb: 512,
    estimatedMs: 3000,
  },
  {
    id: "BACKUP",
    label: "Backup & archive",
    description: "Snapshot and archive, IO bound",
    cores: 1,
    memoryMb: 256,
    estimatedMs: 6000,
  },
  {
    id: "CI_BUILD",
    label: "Repository build",
    description: "Compile and test a GitHub branch",
    cores: 4,
    memoryMb: 1024,
    estimatedMs: 5000,
  },
  {
    id: "CI_DEPLOY",
    label: "Repository deploy",
    description: "Ship a built artifact to an environment",
    cores: 2,
    memoryMb: 768,
    estimatedMs: 4000,
  },
];

export const SUBMITTABLE_TYPES = WORKLOAD_TYPES.filter((t) => !t.id.startsWith("CI_"));

export type WorkloadSize = "SMALL" | "MEDIUM" | "LARGE";

export const SIZES: { id: WorkloadSize; label: string; factor: number }[] = [
  { id: "SMALL", label: "Small", factor: 0.5 },
  { id: "MEDIUM", label: "Medium", factor: 1 },
  { id: "LARGE", label: "Large", factor: 2 },
];

export function getWorkload(id: string): WorkloadType {
  return WORKLOAD_TYPES.find((t) => t.id === id) ?? WORKLOAD_TYPES[0]!;
}

export function resolveResources(typeId: string, size: WorkloadSize) {
  const type = getWorkload(typeId);
  const factor = SIZES.find((s) => s.id === size)?.factor ?? 1;
  return {
    requestedCores: Math.max(1, Math.round(type.cores * factor)),
    requestedMemoryMb: Math.max(64, Math.round((type.memoryMb * factor) / 64) * 64),
    estimatedMs: Math.max(200, Math.round(type.estimatedMs * factor)),
  };
}
