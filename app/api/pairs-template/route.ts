import { actor } from "../../../lib/auth";
import { transaction } from "../../../lib/db";
import { pairsWorkbook } from "../../../lib/pairs-workbook";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await actor())?.admin)
    return new Response("Forbidden", { status: 403 });
  try {
    const workbook = await transaction((s) => pairsWorkbook(s.teams));
    return new Response(Buffer.from(workbook), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="abl-pairs-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
