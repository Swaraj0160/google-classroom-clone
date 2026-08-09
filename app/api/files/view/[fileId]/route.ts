import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { createSupabaseRouteClient } from "@/lib/server/supabaseServer";
import { authorizeFileAccess } from "@/lib/server/fileAuthorization";
import { getFileMeta, downloadFileStream } from "@/lib/server/googleDrive";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const supabase = createSupabaseRouteClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const authorized = await authorizeFileAccess(supabase, fileId, user.id, "read");
    if (!authorized) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const [meta, stream] = await Promise.all([getFileMeta(fileId), downloadFileStream(fileId)]);
    const webStream = Readable.toWeb(stream as Readable) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": meta.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(meta.name)}"`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch (err) {
    console.error("[api/files/view]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "File not found or unavailable." }, { status: 404 });
  }
}
