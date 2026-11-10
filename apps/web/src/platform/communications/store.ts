import type { Transaction } from "@libsql/client";
import { createId, nowIso } from "@/platform/ids";
import { ensureSchema, getClient } from "@/platform/persistence/db";
import { isSqliteConstraint } from "@/platform/persistence/durability-client";
import { withPlatformWriteTransaction } from "@/platform/persistence/write-transaction";
import { normalizeMailboxAddress } from "./policy";

const PROVIDER = "resend";

export class MailboxScopeError extends Error {
  readonly code = "venture_not_in_workspace";

  constructor() {
    super("venture_not_in_workspace");
    this.name = "MailboxScopeError";
  }
}

export class MailboxAddressError extends Error {
  readonly code = "invalid_mailbox_address";

  constructor() {
    super("invalid_mailbox_address");
    this.name = "MailboxAddressError";
  }
}

export class MailboxCollisionError extends Error {
  readonly code = "mailbox_address_collision";

  constructor() {
    super("mailbox_address_collision");
    this.name = "MailboxCollisionError";
  }
}

export type CommunicationMailbox = {
  id: string;
  workspaceId: string;
  ventureId: string;
  address: string;
  status: "active" | "disabled";
};

export type ScopedMessage = {
  id: string;
  workspaceId: string;
  ventureId: string;
  mailboxId: string;
  status: "accepted" | "rejected";
  rejectionReason: string | null;
  fromAddress: string;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  attachmentJson: string;
};

export type InboundCommit =
  | {
      kind: "event";
      providerEventId: string;
      providerMessageId: string | null;
      reason: string;
      workspaceId: string;
      ventureId: string;
      mailboxId: string | null;
    }
  | {
      kind: "message";
      providerEventId: string;
      providerMessageId: string;
      status: "accepted" | "rejected";
      reason: string | null;
      mailboxId: string;
      workspaceId: string;
      ventureId: string;
      rfcMessageId: string;
      threadKey: string;
      fromAddress: string;
      toJson: string;
      subject: string;
      textBody: string | null;
      htmlBody: string | null;
      attachmentJson: string;
      authenticationJson: string;
    };

export type CommitInboundResult = {
  outcome: "stored" | "duplicate";
  messageId: string | null;
};

export type CommunicationsStore = {
  registerMailbox(input: {
    workspaceId: string;
    ventureId: string;
    address: string;
  }): Promise<CommunicationMailbox>;
  findActiveByAddresses(addresses: string[]): Promise<CommunicationMailbox[]>;
  hasProviderEvent(providerEventId: string): Promise<boolean>;
  commitInbound(input: InboundCommit): Promise<CommitInboundResult>;
  getMessage(
    scope: { workspaceId: string; ventureId: string },
    messageId: string,
  ): Promise<ScopedMessage | null>;
  countMessages(): Promise<number>;
  countEvents(): Promise<number>;
};

export function createCommunicationsStore(): CommunicationsStore {
  return {
    async registerMailbox(input) {
      const address = normalizeMailboxAddress(input.address);
      if (!address) throw new MailboxAddressError();
      await ensureSchema();
      return withPlatformWriteTransaction(async (transaction) => {
        const venture = await transaction.execute({
          sql: `SELECT id FROM ventures WHERE id = ? AND workspace_id = ?`,
          args: [input.ventureId, input.workspaceId],
        });
        if (venture.rows.length !== 1) throw new MailboxScopeError();

        const existing = await mailboxByNormalisedAddress(transaction, address);
        if (existing) {
          if (existing.workspaceId !== input.workspaceId || existing.ventureId !== input.ventureId) {
            throw new MailboxScopeError();
          }
          return existing;
        }

        const createdAt = nowIso();
        const id = createId();
        await transaction.execute({
          sql: `INSERT INTO communication_mailboxes (
            id, workspace_id, venture_id, provider, address, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
          args: [id, input.workspaceId, input.ventureId, PROVIDER, address, createdAt, createdAt],
        });
        return {
          id,
          workspaceId: input.workspaceId,
          ventureId: input.ventureId,
          address,
          status: "active" as const,
        };
      });
    },

    async hasProviderEvent(providerEventId) {
      await ensureSchema();
      return eventExists(providerEventId);
    },

    async findActiveByAddresses(addresses) {
      await ensureSchema();
      const requested = [
        ...new Set(
          addresses.flatMap((value) => {
            const address = normalizeMailboxAddress(value);
            return address ? [address] : [];
          }),
        ),
      ];
      if (requested.length === 0) return [];
      const groups = await normalisedMailboxGroups(getClient());
      const found: CommunicationMailbox[] = [];
      for (const address of requested) {
        const mailbox = mailboxForAddress(groups, address);
        if (mailbox?.status === "active") found.push(mailbox);
      }
      return found;
    },

    async commitInbound(input) {
      await ensureSchema();
      try {
        return await withPlatformWriteTransaction((transaction) => writeInbound(transaction, input));
      } catch (error) {
        if (!isSqliteConstraint(error)) throw error;
        if (!(await eventExists(input.providerEventId))) throw error;
        return { outcome: "duplicate" as const, messageId: await findEvent(input.providerEventId) };
      }
    },

    async getMessage(scope, messageId) {
      await ensureSchema();
      const result = await getClient().execute({
        sql: `SELECT id, workspace_id, venture_id, mailbox_id, status, rejection_reason, from_address, subject, text_body, html_body, attachment_json
          FROM communication_messages
          WHERE id = ? AND workspace_id = ? AND venture_id = ?`,
        args: [messageId, scope.workspaceId, scope.ventureId],
      });
      if (result.rows.length !== 1) return null;
      return mapMessage(result.rows[0]);
    },

    async countMessages() {
      return countRows("communication_messages");
    },

    async countEvents() {
      return countRows("communication_provider_events");
    },
  };
}

async function writeInbound(transaction: Transaction, input: InboundCommit): Promise<CommitInboundResult> {
  const existingEvent = await transaction.execute({
    sql: `SELECT message_id FROM communication_provider_events WHERE provider = ? AND provider_event_id = ?`,
    args: [PROVIDER, input.providerEventId],
  });
  if (existingEvent.rows.length === 1) {
    return { outcome: "duplicate", messageId: cell(existingEvent.rows[0], "message_id") };
  }

  if (input.providerMessageId) {
    const existingMessage = await transaction.execute({
      sql: `SELECT id FROM communication_messages WHERE provider = ? AND provider_message_id = ?`,
      args: [PROVIDER, input.providerMessageId],
    });
    if (existingMessage.rows.length === 1) {
      const messageId = cell(existingMessage.rows[0], "id");
      await insertEvent(transaction, {
        providerEventId: input.providerEventId,
        providerMessageId: input.providerMessageId,
        status: "duplicate",
        reason: "duplicate",
        workspaceId: input.workspaceId,
        ventureId: input.ventureId,
        mailboxId: input.kind === "message" ? input.mailboxId : input.mailboxId,
        messageId,
      });
      return { outcome: "duplicate", messageId };
    }
  }

  if (input.kind === "event") {
    await insertEvent(transaction, {
      providerEventId: input.providerEventId,
      providerMessageId: input.providerMessageId,
      status: "rejected",
      reason: input.reason,
      workspaceId: input.workspaceId,
      ventureId: input.ventureId,
      mailboxId: input.mailboxId,
      messageId: null,
    });
    return { outcome: "stored", messageId: null };
  }

  const mailbox = await transaction.execute({
    sql: `SELECT id FROM communication_mailboxes
      WHERE id = ? AND workspace_id = ? AND venture_id = ? AND provider = ? AND status = 'active'`,
    args: [input.mailboxId, input.workspaceId, input.ventureId, PROVIDER],
  });
  if (mailbox.rows.length !== 1) throw new MailboxScopeError();

  const createdAt = nowIso();
  const existingConversation = await transaction.execute({
    sql: `SELECT id FROM communication_conversations WHERE mailbox_id = ? AND thread_key = ?`,
    args: [input.mailboxId, input.threadKey],
  });
  let conversationId = cell(existingConversation.rows[0], "id");
  if (!conversationId) {
    conversationId = createId();
    await transaction.execute({
      sql: `INSERT INTO communication_conversations (
        id, workspace_id, venture_id, mailbox_id, thread_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        conversationId,
        input.workspaceId,
        input.ventureId,
        input.mailboxId,
        input.threadKey,
        createdAt,
        createdAt,
      ],
    });
  } else {
    await transaction.execute({
      sql: `UPDATE communication_conversations SET updated_at = ? WHERE id = ? AND workspace_id = ? AND venture_id = ?`,
      args: [createdAt, conversationId, input.workspaceId, input.ventureId],
    });
  }

  const messageId = createId();
  await transaction.execute({
    sql: `INSERT INTO communication_messages (
      id, workspace_id, venture_id, mailbox_id, conversation_id, provider, provider_message_id,
      provider_event_id, rfc_message_id, direction, status, rejection_reason, from_address,
      to_json, subject, text_body, html_body, attachment_json, authentication_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'inbound', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      messageId,
      input.workspaceId,
      input.ventureId,
      input.mailboxId,
      conversationId,
      PROVIDER,
      input.providerMessageId,
      input.providerEventId,
      input.rfcMessageId,
      input.status,
      input.reason,
      input.fromAddress,
      input.toJson,
      input.subject,
      input.textBody,
      input.htmlBody,
      input.attachmentJson,
      input.authenticationJson,
      createdAt,
    ],
  });
  await insertEvent(transaction, {
    providerEventId: input.providerEventId,
    providerMessageId: input.providerMessageId,
    status: input.status === "accepted" ? "accepted" : "rejected",
    reason: input.reason,
    workspaceId: input.workspaceId,
    ventureId: input.ventureId,
    mailboxId: input.mailboxId,
    messageId,
  });
  return { outcome: "stored", messageId };
}

async function insertEvent(
  transaction: Transaction,
  input: {
    providerEventId: string;
    providerMessageId: string | null;
    status: "accepted" | "rejected" | "duplicate";
    reason: string | null;
    workspaceId: string;
    ventureId: string;
    mailboxId: string | null;
    messageId: string | null;
  },
) {
  await transaction.execute({
    sql: `INSERT INTO communication_provider_events (
      id, provider, provider_event_id, provider_message_id, status, reason,
      workspace_id, venture_id, mailbox_id, message_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      createId(),
      PROVIDER,
      input.providerEventId,
      input.providerMessageId,
      input.status,
      input.reason,
      input.workspaceId,
      input.ventureId,
      input.mailboxId,
      input.messageId,
      nowIso(),
    ],
  });
}

async function findEvent(providerEventId: string): Promise<string | null> {
  const result = await getClient().execute({
    sql: `SELECT message_id FROM communication_provider_events WHERE provider = ? AND provider_event_id = ?`,
    args: [PROVIDER, providerEventId],
  });
  if (result.rows.length !== 1) return null;
  return cell(result.rows[0], "message_id");
}

async function eventExists(providerEventId: string): Promise<boolean> {
  const result = await getClient().execute({
    sql: `SELECT id FROM communication_provider_events WHERE provider = ? AND provider_event_id = ?`,
    args: [PROVIDER, providerEventId],
  });
  return result.rows.length === 1;
}

async function countRows(table: "communication_messages" | "communication_provider_events") {
  await ensureSchema();
  const result = await getClient().execute(
    `SELECT COUNT(*) AS count FROM ${table}`,
  );
  return Number(cell(result.rows[0], "count") ?? "0");
}

/**
 * The address unique index is case-sensitive and cannot represent
 * normalizeMailboxAddress(), including whitespace and display-name wrapping.
 * Rows are matched by that function. One stored row may keep its original
 * text. Two rows that normalise to the same address are a collision:
 * neither ownership is chosen and nothing is rewritten.
 */
async function mailboxByNormalisedAddress(
  executor: Pick<Transaction, "execute">,
  address: string,
): Promise<CommunicationMailbox | null> {
  return mailboxForAddress(await normalisedMailboxGroups(executor), address);
}

async function normalisedMailboxGroups(executor: Pick<Transaction, "execute">) {
  const result = await executor.execute({
    sql: `SELECT id, workspace_id, venture_id, address, status
      FROM communication_mailboxes
      WHERE provider = ?`,
    args: [PROVIDER],
  });
  const groups = new Map<string, CommunicationMailbox[]>();
  for (const row of result.rows) {
    const mailbox = mapMailbox(row);
    if (!mailbox) continue;
    const address = normalizeMailboxAddress(mailbox.address);
    if (!address) continue;
    const group = groups.get(address) ?? [];
    group.push({ ...mailbox, address });
    groups.set(address, group);
  }
  return groups;
}

function mailboxForAddress(
  groups: Map<string, CommunicationMailbox[]>,
  address: string,
): CommunicationMailbox | null {
  const group = groups.get(address) ?? [];
  if (group.length > 1) throw new MailboxCollisionError();
  return group[0] ?? null;
}

function mapMailbox(row: unknown): CommunicationMailbox | null {
  const id = cell(row, "id");
  const workspaceId = cell(row, "workspace_id");
  const ventureId = cell(row, "venture_id");
  const address = cell(row, "address");
  const status = cell(row, "status");
  if (!id || !workspaceId || !ventureId || !address) return null;
  if (status !== "active" && status !== "disabled") return null;
  return { id, workspaceId, ventureId, address, status };
}

function mapMessage(row: unknown): ScopedMessage | null {
  const id = cell(row, "id");
  const workspaceId = cell(row, "workspace_id");
  const ventureId = cell(row, "venture_id");
  const mailboxId = cell(row, "mailbox_id");
  const status = cell(row, "status");
  if (!id || !workspaceId || !ventureId || !mailboxId) return null;
  if (status !== "accepted" && status !== "rejected") return null;
  return {
    id,
    workspaceId,
    ventureId,
    mailboxId,
    status,
    rejectionReason: cell(row, "rejection_reason"),
    fromAddress: cell(row, "from_address") ?? "",
    subject: cell(row, "subject") ?? "",
    textBody: cell(row, "text_body"),
    htmlBody: cell(row, "html_body"),
    attachmentJson: cell(row, "attachment_json") ?? "[]",
  };
}

function cell(row: unknown, name: string): string | null {
  if (!row || typeof row !== "object") return null;
  const value = (row as Record<string, unknown>)[name];
  if (value === null || value === undefined) return null;
  return String(value);
}
