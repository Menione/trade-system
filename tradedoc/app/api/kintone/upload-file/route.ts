import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const KINTONE_DOMAIN = (process.env.KINTONE_DOMAIN || "").trim();
const KINTONE_API_TOKEN = (process.env.KINTONE_API_TOKEN || "").trim();

export async function POST(req: NextRequest) {
  try {
    if (!KINTONE_DOMAIN || !KINTONE_API_TOKEN) {
      return NextResponse.json(
        { error: "Kintoneの環境変数が設定されていません（KINTONE_DOMAIN / KINTONE_API_TOKEN）" },
        { status: 500 }
      );
    }

    const { base64, fileName }: { base64: string; fileName: string } = await req.json();

    if (!base64 || !fileName) {
      return NextResponse.json({ error: "base64またはfileNameが指定されていません" }, { status: 400 });
    }

    const buffer = Buffer.from(base64, "base64");
    const blob = new Blob([buffer], { type: "application/pdf" });

    const form = new FormData();
    form.append("file", blob, fileName);

    const res = await fetch(`https://${KINTONE_DOMAIN}/k/v1/file.json`, {
      method: "POST",
      headers: {
        "X-Cybozu-API-Token": KINTONE_API_TOKEN,
      },
      body: form,
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`ファイルアップロード失敗 (${fileName}):`, text);
      return NextResponse.json(
        { error: `ファイルアップロード失敗 (${fileName}): ${text}` },
        { status: 502 }
      );
    }

    const data = JSON.parse(text);
    return NextResponse.json({ fileKey: data.fileKey as string });
  } catch (e: any) {
    console.error("ファイルアップロードエラー:", e);
    return NextResponse.json({ error: e.message || "不明なエラー" }, { status: 500 });
  }
}
