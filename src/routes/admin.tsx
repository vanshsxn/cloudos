import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Cpu,
  MemoryStick,
  Pause,
  Play,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/dashboard-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { cancelJob, setCredits, setEnginePaused, setPolicy } from "@/lib/engine";
import {
  healthQuery,
  jobsQuery,
  metricsQuery,
  resourcesQuery,
  tenantCreditsQuery,
} from "@/lib/engine-queries";
import { TENANTS, useSession } from "@/lib/session";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal | Smart Cloud Task Engine" },
      {
        name: "description",
        content:
          "Operator control room: monitor every tenant, allocate credits and resources, and steer the scheduler.",
      },
      { property: "og:title", content: "Admin Portal | Smart Cloud Task Engine" },
      {
        property: "og:description",
        content:
          "Operator control room: monitor every tenant, allocate credits and resources, and steer the scheduler.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const POLICIES = ["MLFQ", "ADAPTIVE", "FCFS", "SJF", "PRIORITY", "ROUND_ROBIN"];

function AdminPage() {
  const { isAdmin, ready } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const health = useQuery(healthQuery);
  const metrics = useQuery(metricsQuery);
  const resources = useQuery(resourcesQuery);
  const credits = useQuery(tenantCreditsQuery);
  const jobs = useQuery(jobsQuery(""));

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (ready && !isAdmin) navigate({ to: "/", replace: true });
  }, [ready, isAdmin, navigate]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["engine"] });

  const allocate = useMutation({
    mutationFn: (v: { tenantId: string; credits: number }) => setCredits(v),
    onSuccess: (res) => {
      toast.success(`${res.tenantId} allocated ${res.credits} credits`);
      setDrafts((d) => ({ ...d, [res.tenantId]: "" }));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const policy = useMutation({
    mutationFn: (p: string) => setPolicy({ policy: p }),
    onSuccess: (res) => {
      toast.success(`Scheduling policy set to ${res.policy}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pause = useMutation({
    mutationFn: (p: boolean) => setEnginePaused(p),
    onSuccess: (res) => {
      toast.success(res.paused ? "Engine paused" : "Engine resumed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kill = useMutation({
    mutationFn: (id: number) => cancelJob(id),
    onSuccess: (res) => {
      res.cancelled ? toast.success("Job cancelled") : toast.error(res.message);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) return <div className="min-h-screen bg-background" />;

  const list = jobs.data ?? [];
  const active = list.filter((j) => j.status === "RUNNING" || j.status === "QUEUED");
  const balance = (id: string) =>
    credits.data?.find((c) => c.tenantId === id)?.credits ?? 1000;

  return (
    <AppLayout title="Admin Portal">
      <div className="flex flex-wrap items-center gap-3">
        <Badge className="gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Full operator access
        </Badge>
        <span className="text-sm text-muted-foreground">
          Viewing every tenant, job and resource pool across the cluster.
        </span>
        <div className="ml-auto flex gap-2">
          <Select
            value={health.data?.policy ?? "MLFQ"}
            onValueChange={(v) => policy.mutate(v)}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Policy" />
            </SelectTrigger>
            <SelectContent>
              {POLICIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={health.data?.paused ? "default" : "outline"}
            onClick={() => pause.mutate(!health.data?.paused)}
            disabled={pause.isPending}
          >
            {health.data?.paused ? (
              <>
                <Play className="mr-2 h-4 w-4" /> Resume engine
              </>
            ) : (
              <>
                <Pause className="mr-2 h-4 w-4" /> Pause engine
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tenants managed"
          value={TENANTS.length}
          sub={`${list.length} jobs tracked`}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Active jobs"
          value={active.length}
          sub={`${metrics.data?.queued ?? 0} queued · ${metrics.data?.running ?? 0} running`}
          icon={<Activity className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="CPU in use"
          value={`${(resources.data?.cpuUtilization ?? 0).toFixed(0)}%`}
          sub={`${resources.data?.usedCores ?? 0}/${resources.data?.totalCores ?? 0} cores`}
          icon={<Cpu className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Memory in use"
          value={`${(resources.data?.memoryUtilization ?? 0).toFixed(0)}%`}
          sub={`${resources.data?.usedMemoryMb ?? 0} / ${resources.data?.totalMemoryMb ?? 0} MB`}
          icon={<MemoryStick className="h-5 w-5" />}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tenant resource allocation</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Running</TableHead>
                <TableHead>Queued</TableHead>
                <TableHead>Cores held</TableHead>
                <TableHead>Memory held</TableHead>
                <TableHead>Credits used</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="text-right">Allocate credits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TENANTS.map((t) => {
                const mine = list.filter((j) => j.tenantId === t.id);
                const running = mine.filter((j) => j.status === "RUNNING");
                const queued = mine.filter((j) => j.status === "QUEUED");
                const cores = running.reduce((s, j) => s + j.requestedCores, 0);
                const mem = running.reduce((s, j) => s + j.requestedMemoryMb, 0);
                const used = mine.reduce((s, j) => s + (j.creditsCharged || 0), 0);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.plan}</TableCell>
                    <TableCell className="tabular-nums">{running.length}</TableCell>
                    <TableCell className="tabular-nums">{queued.length}</TableCell>
                    <TableCell className="tabular-nums">{cores}</TableCell>
                    <TableCell className="tabular-nums">{mem} MB</TableCell>
                    <TableCell className="tabular-nums">{used.toFixed(2)}</TableCell>
                    <TableCell className="tabular-nums">{balance(t.id).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Input
                          className="w-28"
                          type="number"
                          placeholder={String(balance(t.id))}
                          value={drafts[t.id] ?? ""}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [t.id]: e.target.value }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!drafts[t.id] || allocate.isPending}
                          onClick={() =>
                            allocate.mutate({
                              tenantId: t.id,
                              credits: Number(drafts[t.id]),
                            })
                          }
                        >
                          Apply
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Live jobs across all tenants</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Cores</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No running or queued jobs right now.
                  </TableCell>
                </TableRow>
              )}
              {active.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.name}</TableCell>
                  <TableCell className="text-muted-foreground">{j.tenantId || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{j.status}</Badge>
                  </TableCell>
                  <TableCell>{j.priority}</TableCell>
                  <TableCell className="tabular-nums">{j.requestedCores}</TableCell>
                  <TableCell className="tabular-nums">{j.requestedMemoryMb} MB</TableCell>
                  <TableCell className="tabular-nums">L{j.queueLevel}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => kill.mutate(j.id)}
                      disabled={kill.isPending}
                    >
                      Cancel
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
