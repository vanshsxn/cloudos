import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/github";

async function gh(path: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GITHUB_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("GitHub is not connected for this project yet.");
  }
  const res = await fetch(`${GATEWAY}/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`GitHub request failed [${res.status}]: ${body}`);
    throw new Error(`GitHub request failed [${res.status}]: ${body}`);
  }
  return res.json();
}

export interface GhRepo {
  fullName: string;
  defaultBranch: string;
  private: boolean;
  updatedAt: string;
  language: string | null;
}

export const listRepos = createServerFn({ method: "GET" }).handler(async (): Promise<GhRepo[]> => {
  const data = (await gh("user/repos?sort=updated&per_page=50")) as any[];
  return data.map((r) => ({
    fullName: r.full_name as string,
    defaultBranch: (r.default_branch as string) ?? "main",
    private: Boolean(r.private),
    updatedAt: (r.updated_at as string) ?? "",
    language: (r.language as string | null) ?? null,
  }));
});

export interface GhRun {
  id: number;
  name: string;
  branch: string;
  event: string;
  status: string;
  conclusion: string | null;
  sha: string;
  createdAt: string;
  url: string;
}

export const listRuns = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ repo: z.string().min(3) }).parse(data))
  .handler(async ({ data }): Promise<GhRun[]> => {
    const res = (await gh(`repos/${data.repo}/actions/runs?per_page=15`)) as {
      workflow_runs?: any[];
    };
    return (res.workflow_runs ?? []).map((r) => ({
      id: r.id as number,
      name: (r.name as string) ?? "workflow",
      branch: (r.head_branch as string) ?? "",
      event: (r.event as string) ?? "",
      status: (r.status as string) ?? "",
      conclusion: (r.conclusion as string | null) ?? null,
      sha: ((r.head_sha as string) ?? "").slice(0, 7),
      createdAt: (r.created_at as string) ?? "",
      url: (r.html_url as string) ?? "",
    }));
  });

export const listBranches = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ repo: z.string().min(3) }).parse(data))
  .handler(async ({ data }): Promise<string[]> => {
    const res = (await gh(`repos/${data.repo}/branches?per_page=50`)) as any[];
    return res.map((b) => b.name as string);
  });
