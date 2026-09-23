import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitJob } from "@/lib/engine";
import type { JobPriority } from "@/lib/engine.types";
import {
  SIZES,
  SUBMITTABLE_TYPES,
  getWorkload,
  resolveResources,
  type WorkloadSize,
} from "@/lib/job-types";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Submit Job | Smart Cloud Task Engine" },
      {
        name: "description",
        content:
          "Queue a real compute workload — data processing, ML training, video encoding, reporting or backup.",
      },
      { property: "og:title", content: "Submit Job | Smart Cloud Task Engine" },
      {
        property: "og:description",
        content:
          "Queue a real compute workload — data processing, ML training, video encoding, reporting or backup.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubmitPage,
});

function SubmitPage() {
  const { tenantId, user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [type, setType] = useState(SUBMITTABLE_TYPES[0]!.id);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<JobPriority>("MEDIUM");
  const [size, setSize] = useState<WorkloadSize>("MEDIUM");

  const workload = getWorkload(type);
  const resources = resolveResources(type, size);
  const jobName = name.trim() || workload.label.toLowerCase().replace(/\s+/g, "-");

  const submit = useMutation({
    mutationFn: () =>
      submitJob({
        name: jobName,
        type,
        priority,
        tenantId: tenantId || "tenant-a",
        userId: user?.email ?? "operator",
        ...resources,
      }),
    onSuccess: (res) => {
      if (!res.accepted) {
        toast.error(res.message);
        return;
      }
      toast.success(`Job #${res.jobId} queued`);
      qc.invalidateQueries({ queryKey: ["engine"] });
      navigate({ to: "/jobs" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout title="Submit Job">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New workload</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit.mutate();
              }}
            >
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Workload</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBMITTABLE_TYPES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{workload.description}</p>
              </div>

              <div className="space-y-1.5">
                <Label>Job name</Label>
                <Input
                  value={name}
                  placeholder={jobName}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as JobPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Workload size</Label>
                <div className="grid grid-cols-3 gap-2">
                  {SIZES.map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      variant={size === s.id ? "default" : "outline"}
                      onClick={() => setSize(s.id)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <Button type="submit" className="w-full" disabled={submit.isPending}>
                  {submit.isPending ? "Submitting…" : "Submit job"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Allocation preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Cores" value={String(resources.requestedCores)} />
            <Row label="Memory" value={`${resources.requestedMemoryMb} MB`} />
            <Row label="Estimated runtime" value={`${(resources.estimatedMs / 1000).toFixed(1)} s`} />
            <Row label="Tenant" value={tenantId || "tenant-a"} />
            <p className="pt-2 text-xs text-muted-foreground">
              Resources are derived from the workload type and size, then allocated by the engine.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
