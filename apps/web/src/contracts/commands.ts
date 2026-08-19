import type { Actor } from "./ids";

export type CommandContext = {
  actor: Actor;
  requestId: string;
};

export type Command<TInput, TOutput> = {
  id: string;
  execute(input: TInput, ctx: CommandContext): Promise<TOutput>;
};
