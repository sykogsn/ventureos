import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { FRIGORA_PWA_ICON_SIZES } from "@/modules/frigora/app/pwa/paths";

export const runtime = "nodejs";

const allowed = new Set<number>(FRIGORA_PWA_ICON_SIZES);

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: raw } = await context.params;
  const size = Number(raw);
  if (!Number.isInteger(size) || !allowed.has(size)) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3d5248",
          color: "#f8f6f1",
          fontSize: Math.round(size * 0.52),
          fontWeight: 650,
          letterSpacing: "-0.06em",
        }}
      >
        F
      </div>
    ),
    {
      width: size,
      height: size,
    },
  );
}
