"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  createWorkOrderFormAction,
  type OfficeFormState,
} from "@/modules/frigora/app/mutation-actions";
import type { WorkCreateOptions } from "@/modules/frigora/app/views";
import { FRIGORA_WORK_KINDS } from "@/modules/frigora/types";

export function CreateWorkOrderForm({
  workspaceId,
  ventureId,
  options,
  initialCustomerId = "",
  initialSiteId = "",
  initialAssetId = "",
}: {
  workspaceId: string;
  ventureId: string;
  options: WorkCreateOptions;
  initialCustomerId?: string;
  initialSiteId?: string;
  initialAssetId?: string;
}) {
  const [state, formAction, pending] = useActionState(
    createWorkOrderFormAction,
    {} as OfficeFormState,
  );

  const [customerId, setCustomerId] = useState(
    state.values?.customerId ?? initialCustomerId,
  );
  const [siteId, setSiteId] = useState(state.values?.siteId ?? initialSiteId);
  const [assetId, setAssetId] = useState(
    state.values?.primaryAssetId ?? initialAssetId,
  );

  const sites = useMemo(() => {
    const customer = options.customers.find((row) => row.customer.id === customerId);
    return customer?.sites ?? [];
  }, [options.customers, customerId]);

  const assets = useMemo(() => {
    const site = sites.find((row) => row.site.id === siteId);
    return site?.assets ?? [];
  }, [sites, siteId]);

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <Stack gap="tight">
        <Field>
          Customer
          <select
            name="customerId"
            required
            className="vos-field"
            value={customerId}
            onChange={(event) => {
              setCustomerId(event.target.value);
              setSiteId("");
              setAssetId("");
            }}
          >
            <option value="">Select customer</option>
            {options.customers.map(({ customer }) => (
              <option key={customer.id} value={customer.id}>
                {customer.displayName} ({customer.code})
              </option>
            ))}
          </select>
        </Field>
        <Field>
          Site
          <select
            name="siteId"
            required
            className="vos-field"
            value={siteId}
            onChange={(event) => {
              setSiteId(event.target.value);
              setAssetId("");
            }}
            disabled={!customerId}
          >
            <option value="">Select site</option>
            {sites.map(({ site }) => (
              <option key={site.id} value={site.id}>
                {site.name} ({site.code})
              </option>
            ))}
          </select>
        </Field>
        <Field>
          Primary asset (optional)
          <select
            name="primaryAssetId"
            className="vos-field"
            value={assetId}
            onChange={(event) => setAssetId(event.target.value)}
            disabled={!siteId}
          >
            <option value="">No primary asset</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.tag}
                {asset.name ? ` — ${asset.name}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          Work reference
          <input
            name="workReference"
            required
            defaultValue={state.values?.workReference ?? ""}
            className="vos-field"
            autoComplete="off"
          />
        </Field>
        <Field>
          Work kind
          <select
            name="workKind"
            required
            defaultValue={state.values?.workKind ?? "reactive"}
            className="vos-field"
          >
            {FRIGORA_WORK_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          Reported condition
          <textarea
            name="reportedCondition"
            rows={4}
            defaultValue={state.values?.reportedCondition ?? ""}
            className="vos-field"
            placeholder="What was reported at intake"
          />
        </Field>
        {state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending || !siteId}>
          {pending ? "Creating…" : "Create work order"}
        </Button>
      </Stack>
    </Form>
  );
}
