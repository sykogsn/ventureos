import type { ReactNode } from "react";
import Link from "next/link";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Fit, Stack } from "@/core/layout";
import { CreateCustomerForm } from "@/modules/frigora/app/forms/create-customer-form";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import type { FrigoraCustomer } from "@/modules/frigora/types";

export function CustomersScreen({
  ctx,
  customers,
  error,
}: {
  ctx: FrigoraOpsContext;
  customers: FrigoraCustomer[];
  error?: string;
}) {
  const base = `/ventures/${ctx.ventureId}/customers`;

  return (
    <PageFrame
      page="Customers"
      kicker="Frigora operations"
      title="Customers"
      description="Operational customers for this Frigora venture."
      ventureId={ctx.ventureId}
    >
      <Stack gap="section">
        {error ? (
          <p className="ids-caption text-danger" role="alert">
            {error}
          </p>
        ) : null}

        {customers.length === 0 ? (
          <EmptyCopy title="No customers yet">
            Create the first customer to begin the office work spine.
          </EmptyCopy>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left">
              <thead>
                <tr className="ids-caption text-muted">
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-t border-[var(--ids-foundation-stroke-subtle)]">
                    <td className="py-3 pr-4 ids-body">
                      <Link href={`${base}/${customer.id}`} className="underline-offset-2 hover:underline">
                        {customer.code}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 ids-body">{customer.displayName}</td>
                    <td className="py-3 pr-4 ids-caption text-muted">{customer.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ctx.canWrite ? (
          <Stack gap="compact">
            <h2 className="ids-label text-foreground">Create customer</h2>
            <CreateCustomerForm
              workspaceId={ctx.workspaceId}
              ventureId={ctx.ventureId}
            />
          </Stack>
        ) : (
          <p className="ids-caption text-muted">
            You can view customers. Creating customers requires venture update permission.
          </p>
        )}
      </Stack>
    </PageFrame>
  );
}

export function CustomerDetailScreen({
  ctx,
  customer,
  sites,
  createSiteSlot,
}: {
  ctx: FrigoraOpsContext;
  customer: FrigoraCustomer;
  sites: Array<{ id: string; code: string; name: string; status: string }>;
  createSiteSlot?: ReactNode;
}) {
  const base = `/ventures/${ctx.ventureId}/customers/${customer.id}`;

  return (
    <PageFrame
      page={customer.displayName}
      kicker="Customer"
      title={customer.displayName}
      description={`Code ${customer.code}`}
      meta={customer.status}
      ventureId={ctx.ventureId}
      actions={
        <Fit>
          <Link href={`/ventures/${ctx.ventureId}/customers`} className="vos-btn-secondary">
            All customers
          </Link>
        </Fit>
      }
    >
      <Stack gap="section">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="ids-caption text-muted">Legal name</dt>
            <dd className="ids-body">{customer.legalName ?? "—"}</dd>
          </div>
          <div>
            <dt className="ids-caption text-muted">Notes</dt>
            <dd className="ids-body whitespace-pre-wrap">{customer.notes ?? "—"}</dd>
          </div>
        </dl>

        <Stack gap="compact">
          <h2 className="ids-label text-foreground">Sites</h2>
          {sites.length === 0 ? (
            <EmptyCopy title="No sites yet">
              Add a site under this customer before creating assets or work orders.
            </EmptyCopy>
          ) : (
            <ul className="divide-y divide-[var(--ids-foundation-stroke-subtle)]">
              {sites.map((site) => (
                <li key={site.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <Link
                    href={`${base}/sites/${site.id}`}
                    className="ids-body underline-offset-2 hover:underline"
                  >
                    {site.name}{" "}
                    <span className="ids-caption text-muted">({site.code})</span>
                  </Link>
                  <span className="ids-caption text-muted">{site.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Stack>

        {createSiteSlot}
      </Stack>
    </PageFrame>
  );
}
