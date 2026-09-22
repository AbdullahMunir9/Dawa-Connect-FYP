import { NextResponse } from "next/server";
import { listApprovedPharmacies } from "@/lib/pharmacyCatalog";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const pharmacies = await listApprovedPharmacies({ limit });
    return NextResponse.json({ pharmacies });
  } catch (error) {
    console.error("Fetch pharmacies error:", error);
    return NextResponse.json({ message: "Unable to load pharmacies" }, { status: 500 });
  }
}
