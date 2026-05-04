import fs from "fs/promises";
import path from "path";

export type PlannerSettingsFile = {
  drivers: unknown[];
  durationRules: unknown[];
  riderRules: unknown[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "planner-settings.json");

const EMPTY_SETTINGS: PlannerSettingsFile = {
  drivers: [],
  durationRules: [],
  riderRules: [],
};

async function ensureSettingsFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(SETTINGS_FILE);
  } catch {
    await fs.writeFile(
      SETTINGS_FILE,
      JSON.stringify(EMPTY_SETTINGS, null, 2),
      "utf8",
    );
  }
}

export async function readPlannerSettingsFile(): Promise<PlannerSettingsFile> {
  await ensureSettingsFile();

  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<PlannerSettingsFile>;

    return {
      drivers: Array.isArray(parsed.drivers) ? parsed.drivers : [],
      durationRules: Array.isArray(parsed.durationRules)
        ? parsed.durationRules
        : [],
      riderRules: Array.isArray(parsed.riderRules) ? parsed.riderRules : [],
    };
  } catch {
    return EMPTY_SETTINGS;
  }
}

export async function writePlannerSettingsFile(
  value: PlannerSettingsFile,
): Promise<void> {
  await ensureSettingsFile();

  await fs.writeFile(
    SETTINGS_FILE,
    JSON.stringify(
      {
        drivers: Array.isArray(value.drivers) ? value.drivers : [],
        durationRules: Array.isArray(value.durationRules)
          ? value.durationRules
          : [],
        riderRules: Array.isArray(value.riderRules) ? value.riderRules : [],
      },
      null,
      2,
    ),
    "utf8",
  );
}