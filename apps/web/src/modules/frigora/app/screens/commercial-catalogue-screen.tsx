"use client";

import { useActionState } from "react";
import { PageFrame } from "@/core";
import { Field, Form, Stack } from "@/core/layout";
import { EmptyCopy } from "@/core/shell/empty-copy";
import {
  saveCommercialItemCostFormAction,
  saveCommercialItemFormAction,
  selectCommercialItemFormAction,
  type CommercialCatalogueFormState,
} from "@/modules/frigora/app/commercial-catalogue-actions";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import type { FrigoraCommercialItem } from "@/modules/frigora/commercial-catalogue";
import { centsToInput, formatZarCents } from "@/modules/frigora/time-materials";
import { FRIGORA_PART_USAGE_UNITS } from "@/modules/frigora/types";

export type CommercialCatalogueFilters = {
  sku: string;
  description: string;
  manufacturer: string;
  model: string;
  category: string;
  status: string;
};

const TAX_OPTIONS = [
  ["not_registered", "Not registered"],
  ["configured_rule", "Configured rule"],
] as const;

function catalogueHref(ventureId: string) {
  return `/ventures/${ventureId}/commercial-catalogue`;
}

function ItemFields({
  values,
  includeStatus,
}: {
  values: Partial<CommercialCatalogueFormState["values"]> & {
    sku?: string;
    description?: string;
    category?: string;
    manufacturer?: string;
    model?: string;
    unit?: string;
    sellingPrice?: string;
    taxTreatment?: string;
    supplierReference?: string;
    status?: string;
  };
  includeStatus: boolean;
}) {
  return (
    <>
      <Field>
        SKU
        <input name="sku" required className="vos-field" defaultValue={values.sku ?? ""} />
      </Field>
      <Field>
        Description
        <input name="description" required className="vos-field" defaultValue={values.description ?? ""} />
      </Field>
      <Field>
        Category
        <input name="category" className="vos-field" defaultValue={values.category ?? ""} />
      </Field>
      <Field>
        Manufacturer
        <input name="manufacturer" className="vos-field" defaultValue={values.manufacturer ?? ""} />
      </Field>
      <Field>
        Model
        <input name="model" className="vos-field" defaultValue={values.model ?? ""} />
      </Field>
      <Field>
        Unit
        <select name="unit" required className="vos-field" defaultValue={values.unit ?? "each"}>
          {FRIGORA_PART_USAGE_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </Field>
      <Field>
        Selling price (R)
        <input
          name="sellingPrice"
          required
          className="vos-field"
          inputMode="decimal"
          placeholder="0.00"
          defaultValue={values.sellingPrice ?? ""}
        />
      </Field>
      <Field>
        Tax treatment
        <select name="taxTreatment" required className="vos-field" defaultValue={values.taxTreatment ?? "not_registered"}>
          {TAX_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field>
        Supplier reference
        <input name="supplierReference" className="vos-field" defaultValue={values.supplierReference ?? ""} />
      </Field>
      {includeStatus ? (
        <Field>
          Status
          <select name="status" className="vos-field" defaultValue={values.status ?? "active"}>
            <option value="active">Active</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </Field>
      ) : null}
    </>
  );
}

function CreateItemForm({ workspaceId, ventureId }: { workspaceId: string; ventureId: string }) {
  const [state, action, pending] = useActionState(saveCommercialItemFormAction, {} as CommercialCatalogueFormState);
  return (
    <Form action={action} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <Stack gap="tight">
        <ItemFields values={state.values ?? {}} includeStatus={false} />
        {state.error ? <p className="ids-caption text-danger" role="alert">{state.error}</p> : null}
        {state.message ? <p className="ids-caption" role="status">{state.message}</p> : null}
        <button type="submit" className="vos-btn-primary" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Add commercial item"}
        </button>
      </Stack>
    </Form>
  );
}

function CostPanel({
  item,
  workspaceId,
  ventureId,
  canReadCost,
  canUpdateCost,
  cost,
}: {
  item: FrigoraCommercialItem;
  workspaceId: string;
  ventureId: string;
  canReadCost: boolean;
  canUpdateCost: boolean;
  cost: number | null | undefined;
}) {
  const [state, action, pending] = useActionState(saveCommercialItemCostFormAction, {} as CommercialCatalogueFormState);
  if (!canReadCost && !canUpdateCost) return null;
  const shown = cost === null || cost === undefined ? "Unavailable" : formatZarCents(cost);
  return (
    <Stack gap="tight">
      {canReadCost ? (
        <p className="ids-caption">
          Purchase cost <span data-cost={item.id}>{shown}</span>
        </p>
      ) : null}
      {canUpdateCost ? (
        <Form action={action} gap="tight">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="ventureId" value={ventureId} />
          <input type="hidden" name="id" value={item.id} />
          <Field>
            Record purchase cost (R)
            <input
              name="purchaseCost"
              className="vos-field"
              inputMode="decimal"
              placeholder="Unavailable"
              defaultValue={cost === null || cost === undefined ? "" : centsToInput(cost)}
            />
          </Field>
          {state.error ? <p className="ids-caption text-danger" role="alert">{state.error}</p> : null}
          {state.message ? <p className="ids-caption" role="status">{state.message}</p> : null}
          <button type="submit" className="vos-btn-primary" disabled={pending} aria-busy={pending}>
            {pending ? "Saving…" : "Save purchase cost"}
          </button>
        </Form>
      ) : null}
    </Stack>
  );
}

function ItemRow({
  item,
  ctx,
  canReadCost,
  canUpdateCost,
  cost,
}: {
  item: FrigoraCommercialItem;
  ctx: FrigoraOpsContext;
  canReadCost: boolean;
  canUpdateCost: boolean;
  cost: number | null | undefined;
}) {
  const [editState, editAction, editPending] = useActionState(saveCommercialItemFormAction, {} as CommercialCatalogueFormState);
  const [selectState, selectAction, selectPending] = useActionState(selectCommercialItemFormAction, {} as CommercialCatalogueFormState);
  const tax = TAX_OPTIONS.find(([value]) => value === item.taxTreatment)?.[1] ?? item.taxTreatment;
  return (
    <article className="rounded-[var(--ids-foundation-radius-sm)] border border-[var(--ids-foundation-stroke-subtle)] p-3">
      <Stack gap="tight">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left">
            <tbody>
              <tr>
                <th className="py-1 pr-4 font-medium">SKU</th>
                <td>{item.sku}</td>
                <th className="py-1 pr-4 font-medium">Description</th>
                <td>{item.description}</td>
              </tr>
              <tr>
                <th className="py-1 pr-4 font-medium">Category</th>
                <td>{item.category || "—"}</td>
                <th className="py-1 pr-4 font-medium">Manufacturer</th>
                <td>{item.manufacturer || "—"}</td>
              </tr>
              <tr>
                <th className="py-1 pr-4 font-medium">Model</th>
                <td>{item.model || "—"}</td>
                <th className="py-1 pr-4 font-medium">Unit</th>
                <td>{item.unit}</td>
              </tr>
              <tr>
                <th className="py-1 pr-4 font-medium">Selling price</th>
                <td>{formatZarCents(item.sellingPriceMinor)}</td>
                <th className="py-1 pr-4 font-medium">Tax treatment</th>
                <td>{tax}</td>
              </tr>
              <tr>
                <th className="py-1 pr-4 font-medium">Status</th>
                <td>{item.status === "active" ? "Active" : "Discontinued"}</td>
                <th className="py-1 pr-4 font-medium">Supplier reference</th>
                <td>{item.supplierReference || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {item.status === "active" ? (
          <Form action={selectAction} gap="tight">
            <input type="hidden" name="workspaceId" value={ctx.workspaceId} />
            <input type="hidden" name="ventureId" value={ctx.ventureId} />
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" className="vos-btn-primary" disabled={selectPending} aria-busy={selectPending}>
              {selectPending ? "Checking…" : "Use on a new quotation"}
            </button>
            {selectState.error ? <p className="ids-caption text-danger" role="alert">{selectState.error}</p> : null}
            {selectState.message ? <p className="ids-caption" role="status">{selectState.message}</p> : null}
          </Form>
        ) : (
          <p className="ids-caption text-muted">Not available for a new quotation.</p>
        )}
        {ctx.canWrite ? (
          <Form action={editAction} gap="tight">
            <input type="hidden" name="workspaceId" value={ctx.workspaceId} />
            <input type="hidden" name="ventureId" value={ctx.ventureId} />
            <input type="hidden" name="id" value={item.id} />
            <ItemFields
              includeStatus
              values={{
                sku: item.sku,
                description: item.description,
                category: item.category,
                manufacturer: item.manufacturer,
                model: item.model,
                unit: item.unit,
                sellingPrice: centsToInput(item.sellingPriceMinor),
                taxTreatment: item.taxTreatment,
                supplierReference: item.supplierReference,
                status: item.status,
                ...editState.values,
              }}
            />
            {editState.error ? <p className="ids-caption text-danger" role="alert">{editState.error}</p> : null}
            {editState.message ? <p className="ids-caption" role="status">{editState.message}</p> : null}
            <button type="submit" className="vos-btn-primary" disabled={editPending} aria-busy={editPending}>
              {editPending ? "Saving…" : "Save commercial item"}
            </button>
          </Form>
        ) : null}
        <CostPanel
          item={item}
          workspaceId={ctx.workspaceId}
          ventureId={ctx.ventureId}
          canReadCost={canReadCost}
          canUpdateCost={canUpdateCost}
          cost={canReadCost ? cost : undefined}
        />
      </Stack>
    </article>
  );
}

export function CommercialCatalogueScreen({
  ctx,
  items,
  filters,
  error,
  canReadCost,
  canUpdateCost,
  costs,
}: {
  ctx: FrigoraOpsContext;
  items: FrigoraCommercialItem[];
  filters: CommercialCatalogueFilters;
  error?: string;
  canReadCost: boolean;
  canUpdateCost: boolean;
  costs: Record<string, number | null> | null;
}) {
  return (
    <PageFrame
      page="Commercial Catalogue"
      kicker="Frigora operations"
      title="Commercial Catalogue"
      description="Selling items for this venture."
      ventureId={ctx.ventureId}
    >
      <Stack gap="section">
        {error ? <p className="ids-caption text-danger" role="alert">{error}</p> : null}
        <form method="get" action={catalogueHref(ctx.ventureId)} className="grid gap-3 md:grid-cols-3">
          <Field>
            SKU
            <input name="sku" className="vos-field" defaultValue={filters.sku} />
          </Field>
          <Field>
            Description
            <input name="description" className="vos-field" defaultValue={filters.description} />
          </Field>
          <Field>
            Manufacturer
            <input name="manufacturer" className="vos-field" defaultValue={filters.manufacturer} />
          </Field>
          <Field>
            Model
            <input name="model" className="vos-field" defaultValue={filters.model} />
          </Field>
          <Field>
            Category
            <input name="category" className="vos-field" defaultValue={filters.category} />
          </Field>
          <Field>
            Lifecycle
            <select name="status" className="vos-field" defaultValue={filters.status}>
              <option value="">Active and discontinued</option>
              <option value="active">Active items</option>
              <option value="discontinued">Discontinued items</option>
            </select>
          </Field>
          <button type="submit" className="vos-btn-primary">Search catalogue</button>
        </form>
        {ctx.canWrite ? <CreateItemForm workspaceId={ctx.workspaceId} ventureId={ctx.ventureId} /> : null}
        {items.length === 0 ? (
          <EmptyCopy title="No commercial items">
            No items match this search. A discontinued item stays on record and cannot be used on a new quotation.
          </EmptyCopy>
        ) : (
          <Stack gap="tight">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                ctx={ctx}
                canReadCost={canReadCost}
                canUpdateCost={canUpdateCost}
                cost={canReadCost ? costs?.[item.id] : undefined}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </PageFrame>
  );
}
