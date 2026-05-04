import { NextRequest, NextResponse } from "next/server";
import {
  readPlannerSettingsFile,
  writePlannerSettingsFile,
} from "@/app/[locale]/(protected)/pages/route-planner/planner-core/planner-settings-file";

type SaveSection =
  | "drivers"
  | "durationRules"
  | "riderRules";

export async function GET() {
  try {
    const settings = await readPlannerSettingsFile();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to read planner settings.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      section?: SaveSection;
      value?: unknown;
    };

    if (
      body.section !== "drivers" &&
      body.section !== "durationRules" &&
      body.section !== "riderRules"
    ) {
      return NextResponse.json(
        { error: "Invalid section." },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.value)) {
      return NextResponse.json(
        { error: "Value must be an array." },
        { status: 400 },
      );
    }

    const current = await readPlannerSettingsFile();

    const updated = {
      ...current,
      [body.section]: body.value,
    };

    await writePlannerSettingsFile(updated);

    return NextResponse.json({
      success: true,
      section: body.section,
      savedCount: body.value.length,
      settings: updated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save planner settings.",
      },
      { status: 500 },
    );
  }
}