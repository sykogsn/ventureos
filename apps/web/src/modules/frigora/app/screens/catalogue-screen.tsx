"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { PageFrame } from "@/core";
import { Field, Form, Stack } from "@/core/layout";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import {
  createPartReferenceFormAction,
  createRefrigerantReferenceFormAction,
  retirePartReferenceFormAction,
  retireRefrigerantReferenceFormAction,
  updatePartReferenceFormAction,
  updateRefrigerantReferenceFormAction,
  type CatalogueFormState,
} from "@/modules/frigora/app/catalogue-mutation-actions";
import {
  FRIGORA_PART_USAGE_UNITS,
  type FrigoraPartReference,
  type FrigoraRefrigerantReference,
} from "@/modules/frigora/types";

function CreatePartForm({
  workspaceId,
  ventureId,
}: {
  workspaceId: string;
  ventureId: string;
}) {
  const [state, action, pending] = useActionState(
    createPartReferenceFormAction,
    {} as CatalogueFormState,
  );
  return (
    <Form action={action} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <Stack gap="tight">
        <Field>
          Display name
          <input
            name="displayName"
            required
            className="vos-field"
            defaultValue={state.values?.displayName ?? ""}
          />
        </Field>
        <Field>
          Default unit
          <select
            name="defaultQuantityUnit"
            required
            className="vos-field"
            defaultValue={state.values?.defaultQuantityUnit ?? "each"}
          >
            {FRIGORA_PART_USAGE_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </Field>
        {state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Add part reference"}
        </Button>
      </Stack>
    </Form>
  );
}

function CreateRefrigerantForm({
  workspaceId,
  ventureId,
}: {
  workspaceId: string;
  ventureId: string;
}) {
  const [state, action, pending] = useActionState(
    createRefrigerantReferenceFormAction,
    {} as CatalogueFormState,
  );
  return (
    <Form action={action} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <Stack gap="tight">
        <Field>
          Canonical code
          <input
            name="canonicalCode"
            required
            className="vos-field"
            placeholder="R404A"
            defaultValue={state.values?.canonicalCode ?? ""}
          />
        </Field>
        <Field>
          Display name
          <input
            name="displayName"
            required
            className="vos-field"
            defaultValue={state.values?.displayName ?? ""}
          />
        </Field>
        {state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Add refrigerant reference"}
        </Button>
      </Stack>
    </Form>
  );
}

function PartRow({
  row,
  workspaceId,
  ventureId,
  canAdmin,
}: {
  row: FrigoraPartReference;
  workspaceId: string;
  ventureId: string;
  canAdmin: boolean;
}) {
  const [updateState, updateAction, updatePending] = useActionState(
    updatePartReferenceFormAction,
    {} as CatalogueFormState,
  );
  const [retireState, retireAction, retirePending] = useActionState(
    retirePartReferenceFormAction,
    {} as CatalogueFormState,
  );
  return (
    <li className="rounded-[var(--ids-foundation-radius-sm)] border border-[var(--ids-foundation-stroke-subtle)] p-3">
      <Stack gap="tight">
        <p className="ids-caption text-muted">
          {row.status} · {row.id}
        </p>
        {canAdmin && row.status === "active" ? (
          <>
            <Form action={updateAction} gap="tight">
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="ventureId" value={ventureId} />
              <input type="hidden" name="id" value={row.id} />
              <Field>
                Display name
                <input
                  name="displayName"
                  required
                  className="vos-field"
                  defaultValue={row.displayName}
                />
              </Field>
              <Field>
                Default unit
                <select
                  name="defaultQuantityUnit"
                  required
                  className="vos-field"
                  defaultValue={row.defaultQuantityUnit}
                >
                  {FRIGORA_PART_USAGE_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </Field>
              {updateState.error ? (
                <p className="ids-caption text-danger">{updateState.error}</p>
              ) : null}
              <Button type="submit" disabled={updatePending} className="vos-btn-secondary">
                Save
              </Button>
            </Form>
            <Form action={retireAction} gap="tight">
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="ventureId" value={ventureId} />
              <input type="hidden" name="id" value={row.id} />
              {retireState.error ? (
                <p className="ids-caption text-danger">{retireState.error}</p>
              ) : null}
              <Button type="submit" disabled={retirePending} className="vos-btn-secondary">
                Retire
              </Button>
            </Form>
          </>
        ) : (
          <p className="ids-body">
            {row.displayName} · default {row.defaultQuantityUnit}
          </p>
        )}
      </Stack>
    </li>
  );
}

function RefrigerantRow({
  row,
  workspaceId,
  ventureId,
  canAdmin,
}: {
  row: FrigoraRefrigerantReference;
  workspaceId: string;
  ventureId: string;
  canAdmin: boolean;
}) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateRefrigerantReferenceFormAction,
    {} as CatalogueFormState,
  );
  const [retireState, retireAction, retirePending] = useActionState(
    retireRefrigerantReferenceFormAction,
    {} as CatalogueFormState,
  );
  return (
    <li className="rounded-[var(--ids-foundation-radius-sm)] border border-[var(--ids-foundation-stroke-subtle)] p-3">
      <Stack gap="tight">
        <p className="ids-caption text-muted">
          {row.status} · {row.id}
        </p>
        {canAdmin && row.status === "active" ? (
          <>
            <Form action={updateAction} gap="tight">
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="ventureId" value={ventureId} />
              <input type="hidden" name="id" value={row.id} />
              <Field>
                Canonical code
                <input
                  name="canonicalCode"
                  required
                  className="vos-field"
                  defaultValue={row.canonicalCode}
                />
              </Field>
              <Field>
                Display name
                <input
                  name="displayName"
                  required
                  className="vos-field"
                  defaultValue={row.displayName}
                />
              </Field>
              {updateState.error ? (
                <p className="ids-caption text-danger">{updateState.error}</p>
              ) : null}
              <Button type="submit" disabled={updatePending} className="vos-btn-secondary">
                Save
              </Button>
            </Form>
            <Form action={retireAction} gap="tight">
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="ventureId" value={ventureId} />
              <input type="hidden" name="id" value={row.id} />
              {retireState.error ? (
                <p className="ids-caption text-danger">{retireState.error}</p>
              ) : null}
              <Button type="submit" disabled={retirePending} className="vos-btn-secondary">
                Retire
              </Button>
            </Form>
          </>
        ) : (
          <p className="ids-body">
            {row.canonicalCode} — {row.displayName}
          </p>
        )}
      </Stack>
    </li>
  );
}

export function CatalogueScreen({
  ctx,
  partReferences,
  refrigerantReferences,
  canAdmin,
  error,
}: {
  ctx: FrigoraOpsContext;
  partReferences: FrigoraPartReference[];
  refrigerantReferences: FrigoraRefrigerantReference[];
  canAdmin: boolean;
  error?: string;
}) {
  return (
    <PageFrame
      page="Catalogue"
      kicker="F3.0"
      title="Parts & refrigerant catalogues"
      description="Venture-scoped reference identities for operational recording. Not inventory. Not costing."
      ventureId={ctx.ventureId}
    >
      <Stack gap="section">
        {error ? (
          <p className="ids-caption text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <section className="space-y-3">
          <h2 className="ids-label">Parts</h2>
          {canAdmin ? (
            <CreatePartForm workspaceId={ctx.workspaceId} ventureId={ctx.ventureId} />
          ) : (
            <p className="ids-caption text-muted">
              Catalogue administration requires venture update authority.
            </p>
          )}
          <ul className="list-none space-y-3">
            {partReferences.map((row) => (
              <PartRow
                key={row.id}
                row={row}
                workspaceId={ctx.workspaceId}
                ventureId={ctx.ventureId}
                canAdmin={canAdmin}
              />
            ))}
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="ids-label">Refrigerants</h2>
          {canAdmin ? (
            <CreateRefrigerantForm
              workspaceId={ctx.workspaceId}
              ventureId={ctx.ventureId}
            />
          ) : null}
          <ul className="list-none space-y-3">
            {refrigerantReferences.map((row) => (
              <RefrigerantRow
                key={row.id}
                row={row}
                workspaceId={ctx.workspaceId}
                ventureId={ctx.ventureId}
                canAdmin={canAdmin}
              />
            ))}
          </ul>
        </section>
      </Stack>
    </PageFrame>
  );
}
