import { NextResponse } from "next/server";
import { clearMarketplaceSession } from "@/lib/authSession";

export async function POST() {
  try {
    const response = NextResponse.json({ message: "Logout successful" }, { status: 200 });
    
    return clearMarketplaceSession(response);
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ message: "An error occurred during logout" }, { status: 500 });
  }
}
