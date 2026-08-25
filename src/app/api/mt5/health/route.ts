import { NextResponse } from "next/server";

const BRIDGE_URL = "http://127.0.0.1:8787";

export async function GET() {
  try {
    const response = await fetch(`${BRIDGE_URL}/health`, {
      cache: "no-store",
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      {
        connected: false,
        error: "MT5 bridge offline",
      },
      {
        status: 503,
      }
    );
  }
}