import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { getEmailVerificationConfig } from "@/lib/emailConfig";
import { getResendClient } from "@/lib/resendEmail";
import PendingRegistration from "@/models/PendingRegistration";

export const runtime = "nodejs";

function failureText(event) {
  return String(
    event?.data?.bounce?.message
      || event?.data?.failed?.reason
      || event?.data?.reason
      || "The receiving mail server rejected the message."
  ).slice(0, 500);
}

export async function POST(req) {
  try {
    const payload = await req.text();
    const { webhookSecret } = getEmailVerificationConfig();
    if (!webhookSecret) {
      return NextResponse.json({ message: "Webhook verification is not configured." }, { status: 503 });
    }
    const event = getResendClient().webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") || "",
        timestamp: req.headers.get("svix-timestamp") || "",
        signature: req.headers.get("svix-signature") || "",
      },
      webhookSecret,
    });

    const emailId = event?.data?.email_id;
    const statusByType = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.delivery_delayed": "delayed",
      "email.bounced": "bounced",
      "email.failed": "failed",
    };
    const deliveryStatus = statusByType[event?.type];
    if (emailId && deliveryStatus) {
      await connectToDatabase();
      const update = { deliveryStatus };
      if (["bounced", "failed"].includes(deliveryStatus)) update.deliveryFailure = failureText(event);
      await PendingRegistration.updateOne({ lastEmailId: emailId }, { $set: update });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Invalid Resend webhook:", error?.message || error);
    return NextResponse.json({ message: "Invalid webhook signature." }, { status: 400 });
  }
}
