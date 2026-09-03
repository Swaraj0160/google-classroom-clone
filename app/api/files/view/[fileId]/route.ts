import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { createSupabaseRouteClient } from "@/lib/server/supabaseServer";
import { authorizeFileAccess } from "@/lib/server/fileAuthorization";
import { getFileMeta, downloadFileStream, classifyDriveError, sanitizeDriveError } from "@/lib/server/googleDrive";

const CATEGORY_RESPONSE: Record<string, { status: number; message: string }> = {
  INVALID_FILE_ID: { status: 400, message: "Invalid file reference." },
  LEGACY_STORAGE_PATH: {
    status: 400,
    message: "This file reference is not Drive-backed and can't be served by this route.",
  },
  DRIVE_FILE_NOT_FOUND: { status: 404, message: "This file is no longer available in storage." },
  DRIVE_PERMISSION_DENIED: {
    status: 503,
    message: "File storage access was denied. Please contact your administrator.",
  },
  DRIVE_AUTH_FAILED: {
    status: 503,
    message: "Google Drive storage authentication has expired. Please contact your administrator.",
  },
  DRIVE_STORAGE_QUOTA_EXCEEDED: {
    status: 503,
    message: "Storage quota has been exceeded. Please contact your administrator.",
  },
  DRIVE_RATE_LIMITED: {
    status: 503,
    message: "File storage is temporarily busy. Please try again in a moment.",
  },
  DRIVE_NETWORK_ERROR: {
    status: 502,
    message: "Could not reach file storage. Please check your connection and try again.",
  },
  DRIVE_DOWNLOAD_FAILED: { status: 502, message: "File could not be retrieved. Please try again." },
  UNEXPECTED_ERROR: { status: 500, message: "File could not be retrieved. Please try again." },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  // Defensive input validation — this route only ever serves Drive file ids
  // (no "/"); a legacy Supabase Storage path or an empty/malformed value
  // must never be handed to the Drive API and misreported as "not found".
  if (!fileId || typeof fileId !== "string") {
    console.error("[api/files/view] category=INVALID_FILE_ID", { fileId });
    const r = CATEGORY_RESPONSE.INVALID_FILE_ID;
    return NextResponse.json({ error: r.message }, { status: r.status });
  }
  if (fileId.includes("/")) {
    console.error("[api/files/view] category=LEGACY_STORAGE_PATH", { fileId });
    const r = CATEGORY_RESPONSE.LEGACY_STORAGE_PATH;
    return NextResponse.json({ error: r.message }, { status: r.status });
  }

  try {
    const supabase = createSupabaseRouteClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const authorized = await authorizeFileAccess(supabase, fileId, user.id, "read");
    if (!authorized) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    let meta, stream;
    try {
      [meta, stream] = await Promise.all([getFileMeta(fileId), downloadFileStream(fileId)]);
    } catch (driveErr) {
      const category = classifyDriveError(driveErr);
      const reason = sanitizeDriveError(driveErr);
      console.error(
        "[FILE_RETRIEVAL_FAILED]",
        JSON.stringify({
          driveFileId: fileId,
          provider: "google_drive",
          category,
          reason: reason.message ?? reason.reason ?? String(reason.code ?? "unknown"),
        })
      );
      const r = CATEGORY_RESPONSE[category];
      return NextResponse.json({ error: r.message }, { status: r.status });
    }

    const webStream = Readable.toWeb(stream as Readable) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": meta.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(meta.name)}"`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch (err) {
    console.error("[api/files/view] category=UNEXPECTED_ERROR", { fileId }, err instanceof Error ? err.message : err);
    const r = CATEGORY_RESPONSE.UNEXPECTED_ERROR;
    return NextResponse.json({ error: r.message }, { status: r.status });
  }
}
