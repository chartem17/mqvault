import { NextResponse } from "next/server";

const MT5_BRIDGE_URL = "http://127.0.0.1:8787";

export async function GET() {
  try {
    const response = await fetch(`${MT5_BRIDGE_URL}/history`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          connected: false,
          deals: [],
          initialDeposit: null,
          error: `MT5 bridge returned ${response.status}`,
        },
        { status: 502 },
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json(
      {
        connected: false,
        deals: [],
        initialDeposit: null,
        error: "MT5 bridge offline",
      },
      { status: 503 },
    );
  }
}