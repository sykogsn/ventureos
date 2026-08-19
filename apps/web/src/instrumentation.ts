export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrapPlatform } = await import("@/platform/bootstrap");
    await bootstrapPlatform();
  }
}
