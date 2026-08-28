"use client";

import { useEffect, useState } from "react";
import { useShell } from "@/core/context/shell-context";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Cluster, Ledger, Pulse, Stack } from "@/core/layout";
import { loadWorkforceEmployeeDirectoryAction } from "@/modules/workforce/actions";
import type { WorkforceEmployeeDirectoryEntry } from "@/modules/workforce/employees-read-model";
import { cn } from "@/utils/cn";

const statusToneClass = {
  healthy: "ids-status-healthy",
  quiet: "ids-status-quiet",
  risk: "ids-status-risk",
} as const;

function EmployeeDirectorySkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <Stack gap="compact">
        <Pulse height="3" width="third" />
        <Pulse height="5" width="majority" />
        <Pulse width="wide" />
        <span className="sr-only">Loading employees…</span>
      </Stack>
    </div>
  );
}

function EmployeeRow({ employee }: { employee: WorkforceEmployeeDirectoryEntry }) {
  return (
    <li>
      <Stack gap="tight">
        <Cluster justify="between">
          <p className="ids-label text-foreground">{employee.name}</p>
          <span
            className={cn("ids-pill", statusToneClass[employee.statusTone])}
          >
            {employee.statusLabel}
          </span>
        </Cluster>
        <p className="ids-caption text-muted">
          {employee.role} · {employee.employeeType}
        </p>
        <dl className="grid gap-[var(--ids-foundation-space-1)] sm:grid-cols-2">
          <div>
            <dt className="ids-caption text-muted">Company</dt>
            <dd className="ids-body">{employee.ventureName}</dd>
          </div>
          <div>
            <dt className="ids-caption text-muted">Readiness</dt>
            <dd>
              <span
                className={cn(
                  "ids-pill",
                  statusToneClass[employee.readinessTone],
                )}
              >
                {employee.readinessLabel}
              </span>
            </dd>
          </div>
          {employee.autonomyLabel ? (
            <div>
              <dt className="ids-caption text-muted">Autonomy</dt>
              <dd className="ids-body">{employee.autonomyLabel}</dd>
            </div>
          ) : null}
          {employee.capabilitySummary ? (
            <div>
              <dt className="ids-caption text-muted">Capabilities</dt>
              <dd className="ids-body">{employee.capabilitySummary}</dd>
            </div>
          ) : null}
          <div>
            <dt className="ids-caption text-muted">Version</dt>
            <dd className="ids-body">v{employee.definitionVersion}</dd>
          </div>
        </dl>
      </Stack>
    </li>
  );
}

export function WorkforceEmployeeDirectory() {
  const { activeVentureId, ventures } = useShell();
  const [employees, setEmployees] = useState<WorkforceEmployeeDirectoryEntry[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedVentureId, setLoadedVentureId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeVentureId) {
      setEmployees([]);
      setError(null);
      setLoading(false);
      setLoadedVentureId(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void loadWorkforceEmployeeDirectoryAction({ ventureId: activeVentureId })
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.error) {
          setEmployees([]);
          setError(result.error);
          setLoadedVentureId(activeVentureId);
          return;
        }
        setEmployees(result.employees ?? []);
        setError(null);
        setLoadedVentureId(activeVentureId);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeVentureId]);

  if (!activeVentureId) {
    const hasCompanies = ventures.length > 0;
    return (
      <EmptyCopy title={hasCompanies ? "Select a company" : "No company on this desk"}>
        {hasCompanies
          ? "Choose the company in the header switcher to inspect its AI employees."
          : "Found a company before Workforce can list governed employees."}
      </EmptyCopy>
    );
  }

  if (loading && loadedVentureId !== activeVentureId) {
    return <EmployeeDirectorySkeleton />;
  }

  if (error) {
    return (
      <EmptyCopy title="Employees could not be loaded">
        {error}
      </EmptyCopy>
    );
  }

  if (employees.length === 0) {
    return (
      <EmptyCopy title="No AI employees in this company">
        Governed employees appear here once they are registered and active for
        this company. This desk is read-first.
      </EmptyCopy>
    );
  }

  return (
    <Ledger>
      {employees.map((employee) => (
        <EmployeeRow key={employee.id} employee={employee} />
      ))}
    </Ledger>
  );
}
