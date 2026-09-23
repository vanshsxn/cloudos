import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addDeployment } from "@/lib/deployments";
import { submitJob } from "@/lib/engine";
import { listBranches, listRepos, listRuns } from "@/lib/github.functions";
import { getWorkload, resolveResources } from "@/lib/job-types";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/github")({
  head: () => ({
    meta: [
      { title: "GitHub | Smart Cloud Task Engine" },
      {
        name: "description",
        content: "Browse connected repositories, watch workflow runs and launch build or deploy jobs.",
      },
      { property: "og:title", content: "GitHub | Smart Cloud Task Engine" },
      {
        property: "og:description",
        content: "Browse connected repositories, watch workflow runs and launch build or deploy jobs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GithubPage,
});

function GithubPage() {
  const { tenantId, user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const fetchRepos = useServerFn(listRepos);
  const fetchRuns = useServerFn(listRuns);
  const fetchBranches = useServerFn(listBranches);

  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [mode, setMode] = useState<"CI_BUILD" | "CI_DEPLOY">("CI_BUILD");

  const repos = useQuery({ queryKey: ["github", "repos"], queryFn: () => fetchRepos(), retry: false });

  useEffect(() => {
    if (!repo && repos.data?.length) {
      setRepo(repos.data[0]!.fullName);
      setBranch(repos.data[0]!.defaultBranch);
    }
  }, [repo, repos.data]);

  const runs = useQuery({
    queryKey: ["github", "runs", repo],
    queryFn: () => fetchRuns({ data: { repo } }),
    enabled: Boolean(repo),
    retry: false,
  });

  const branches = useQuery({
    queryKey: ["github", "branches", repo],
    queryFn: () => fetchBranches({ data: { repo } }),
    enabled: Boolean(repo),
    retry: false,
  });

  const launch = useMutation({
    mutationFn: async () => {
      const resources = resolveResources(mode, "MEDIUM");
      const jobName = `${repo.split("/")[1] ?? repo}@${branch || "main"}`;
      const res = await submitJob({
        name: jobName,
        type: mode,
        priority: mode === "CI_DEPLOY" ? "HIGH" : "MEDIUM",
        tenantId: tenantId || "tenant-a",
        userId: user?.email ?? "operator",
        ...resources,
      });
      if (!res.accepted) throw new Error(res.message);
      addDeployment({
        id: `${Date.now()}`,
        repoFullName: repo,
        branch: branch || "main",
        mode,
        jobId: res.jobId,
        jobName,
        createdAt: Date.now(),
        ...resources,
      });
      return res;
    },
    onSuccess: (res) => {
      toast.success(`${mode === "CI_DEPLOY" ? "Deploy" : "Build"} job #${res.jobId} queued`);
      qc.invalidateQueries({ queryKey: ["engine"] });
      navigate({ to: "/deployments" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const workload = getWorkload(mode);
  const preview = resolveResources(mode, "MEDIUM");

  return (
    <AppLayout title="GitHub">
      {repos.isError ? (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            Could not reach GitHub: {(repos.error as Error).message}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent workflow runs</CardTitle>
            <Select value={repo} onValueChange={(v) => {
              setRepo(v);
              setBranch(repos.data?.find((r) => r.fullName === v)?.defaultBranch ?? "main");
            }}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder={repos.isLoading ? "Loading repositories…" : "Select repository"} />
              </SelectTrigger>
              <SelectContent>
                {(repos.data ?? []).map((r) => (
                  <SelectItem key={r.fullName} value={r.fullName}>
                    {r.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(runs.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.branch}</TableCell>
                    <TableCell className="font-mono text-xs">{r.sha}</TableCell>
                    <TableCell>
                      <Badge variant={r.conclusion === "success" ? "default" : r.conclusion ? "destructive" : "secondary"}>
                        {r.conclusion ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {!runs.isLoading && (runs.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No workflow runs for this repository.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Launch a job</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">Branch</p>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {(branches.data ?? []).map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">Action</p>
              <Select value={mode} onValueChange={(v) => setMode(v as "CI_BUILD" | "CI_DEPLOY")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CI_BUILD">Build repository</SelectItem>
                  <SelectItem value="CI_DEPLOY">Deploy repository</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{workload.description}</p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cores</span>
                <span className="font-medium">{preview.requestedCores}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Memory</span>
                <span className="font-medium">{preview.requestedMemoryMb} MB</span>
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!repo || launch.isPending}
              onClick={() => launch.mutate()}
            >
              {launch.isPending ? "Queueing…" : "Queue job"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
