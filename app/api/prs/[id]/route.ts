import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const pr = await prisma.trackedPR.findUnique({
    where: { id },
    include: {
      changes: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!pr) {
    return NextResponse.json({ error: "PR not found" }, { status: 404 });
  }

  return NextResponse.json(pr);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (body.action === "dismiss") {
    const pr = await prisma.trackedPR.update({
      where: { id },
      data: { status: "dismissed" },
    });
    return NextResponse.json(pr);
  }

  if (body.action === "retrack") {
    const pr = await prisma.trackedPR.update({
      where: { id },
      data: { status: "open" },
    });
    return NextResponse.json(pr);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
