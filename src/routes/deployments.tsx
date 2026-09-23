import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Cpu, HardDrive, Rocket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/dashboard-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clearDeployments, listDeployments, type DeploymentRecord } from "@/lib/deployments";
import { jobsQuery, resourcesQuery } from "@/lib/engine-queries";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/deployments")({
  head: () => ({
    meta: [
      { title: "Deployments | Smart Cloud Task Engine" },
      {
        name: "description",
        content: "Resource allocation per GitHub deployment: cores, memory, credits and live status.",
      },
      { property: "og:title", content: "Deployments | Smart Cloud Task Engine" },
      {
        property: "og:description",
        content: "Resource allocation per GitHub deployment: cores, memory, credits and live status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeploymentsPage,
});

function DeploymentsPage() {
  const { tenantId } = useSession();
  const [records, setRecords] = useState<DeploymentRecord[]>([]);

  useEffect(() => {
    const sync = () => setRecords(listDeployments());
    sync();
    window.addEventListener("mvcc-deployments", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("mvcc-deployments", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const jobs = useQuery(jobsQuery(tenantId));
  const resources = useQuery(resourcesQuery);

  const rows = useMemo(
    () =>
      records.map((d) => {
        const job = jobs.data?.find((j) => j.id === d.jobId);
        return {
          ...d,
          status: job?.status ?? "UNKNOWN",
          cores: job?.requestedCores ?? d.requestedCores,
          memory: job?.requestedMemoryMb ?? d.requestedMemoryMb,
          credits: job?.creditsCharged || job?.estimatedCredits || 0,
        };
      }),
    [records, jobs.data],
  );

  const totalCores = resources.data?.totalCores ?? 0;
  const totalMemory = resources.data?.totalMemoryMb ?? 0;
  const active = rows.filter((r) => r.status === "RUNNING" || r.status === "QUEUED" || r.status === "PENDING");
  const usedCores = active.reduce((a, r) => a + r.cores, 0);
  const usedMemory = active.reduce((a, r) => a + r.memory, 0);
  const usedCredits = rows.reduce((a, r) => a + r.credits, 0);

  return (
    <AppLayout title="Deployments">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Active deployments"
          value={String(active.length)}
          icon={Rocket}
          hint={`${rows.length} tracked`}
        />
        <StatCard
          label="Cores allocated"
          value={totalCores ? `${usedCores} / ${totalCores}` : String(usedCores)}
          icon={Cpu}
          hint="Across in-flight deployments"
        />
        <StatCard
          label="Memory allocated"
          value={`${usedMemory} MB`}
          icon={HardDrive}
          hint={totalMemory ? `of ${totalMemory} MB` : "engine offline"}
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Share of engine capacity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Bar label="Cores" used={usedCores} total={totalCores} suffix="cores" />
          <Bar label="Memory" used={usedMemory} total={totalMemory} suffix="MB" />
          <p className="text-xs text-muted-foreground">Credits consumed by deployments: {usedCredits.toFixed(2)}</p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Per-deployment allocation</CardTitle>
          {rows.length ? (
            <Button variant="outline" size="sm" onClick={clearDeployments}>
              Clear history
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Repository</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Cores</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.repoFullName}</TableCell>
                  <TableCell>{r.branch}</TableCell>
                  <TableCell>{r.mode === "CI_DEPLOY" ? "Deploy" : "Build"}</TableCell>
                  <TableCell className="font-mono text-xs">#{r.jobId}</TableCell>
                  <TableCell>{r.cores}</TableCell>
                  <TableCell>{r.memory} MB</TableCell>
                  <TableCell>{r.credits.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "COMPLETED"
                          ? "default"
                          : r.status === "FAILED" || r.status === "CANCELLED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No deployments yet — launch one from the GitHub page.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function Bar({
  label,
  used,
  total,
  suffix,
}: {
  label: string;
  used: number;
  total: number;
  suffix: string;
}) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used} / {total || "—"} {suffix}
        </span>
      </div>
      <Progress value={pct} />
    </div>
  );
}
