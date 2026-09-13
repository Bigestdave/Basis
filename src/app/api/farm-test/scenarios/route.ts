import { ok, route } from "@/lib/http";
import { listFarmScenarios } from "@/services/farm-test";

export const dynamic = "force-dynamic";

export const GET = route({ auth: "none" }, async () => ok({ scenarios: await listFarmScenarios() }));
