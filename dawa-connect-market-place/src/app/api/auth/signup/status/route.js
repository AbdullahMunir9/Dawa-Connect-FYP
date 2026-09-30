import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import PendingRegistration from "@/models/PendingRegistration";

export const runtime = "nodejs";

export async function GET(req) {
  const challengeId = req.nextUrl.searchParams.get("challengeId") || "";
  if (challengeId.length < 30) {
    return NextResponse.json({ message: "Invalid verification request." }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const pending = await PendingRegistration.findOne({ challengeId }).select(
      "deliveryStatus deliveryFailure expiresAt resendAvailableAt"
    );
    if (!pending) {
      return NextResponse.json(
        { status: "expired", message: "This verification request has expired." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    const failed = ["bounced", "failed"].includes(pending.deliveryStatus);
    return NextResponse.json({
      status: pending.deliveryStatus,
      message: failed ? "The email could not be delivered. Check the address and start again." : "",
      expiresAt: pending.expiresAt.toISOString(),
      resendAvailableAt: pending.resendAvailableAt.toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Signup delivery status error:", error?.message || error);
    return NextResponse.json({ message: "Could not check email delivery." }, { status: 500 });
  }
}
