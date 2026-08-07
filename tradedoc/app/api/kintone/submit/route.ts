import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
const KINTONE_DOMAIN = (process.env.KINTONE_DOMAIN || "").trim();
const KINTONE_API_TOKEN = (process.env.KINTONE_API_TOKEN || "").trim();
const KINTONE_APP_ID = (process.env.KINTONE_APP_ID || "").trim();
// docType（フロントエンドで生成されるキー）→ Kintoneの添付ファイル用フィールドコード
const DOC_TYPE_TO_FIELD: Record<string, string> = {
  invoice: "INVOICE",
  commercial: "CommercialINV",
  packing: "PackingList",
  deliveryNote: "DeliveryNote",
  deliveryReceipt: "DeliveryReceipt",
};
type FileKeyEntry = {
  docType: string;
  fileKey: string;
};
async function createKintoneRecord(record: Record<string, { value: any }>) {
  const body = JSON.stringify({ app: KINTONE_APP_ID, record });
  const res = await fetch(`https://${KINTONE_DOMAIN}/k/v1/record.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cybozu-API-Token": KINTONE_API_TOKEN,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    // デバッグ用に送信したJSONをログに残す（Vercelのログで確認可能）
    console.error("Kintoneレコード作成失敗 送信body:", body);
    console.error("Kintoneレコード作成失敗 レスポンス:", text);
    throw new Error(text);
  }
  return JSON.parse(text);
}

// 既存レコードを更新する（再連携／上書き用）。
// kintoneRecordIdはKintoneのレコードid（レコード作成時にKintoneが返すid）で、
// tradedoc_id（tradedoc側のinvoiceId）とは別物なので混同しないこと。
async function updateKintoneRecord(kintoneRecordId: string, record: Record<string, { value: any }>) {
  const body = JSON.stringify({ app: KINTONE_APP_ID, id: kintoneRecordId, record });
  const res = await fetch(`https://${KINTONE_DOMAIN}/k/v1/record.json`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Cybozu-API-Token": KINTONE_API_TOKEN,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Kintoneレコード更新失敗 送信body:", body);
    console.error("Kintoneレコード更新失敗 レスポンス:", text);
    throw new Error(text);
  }
  // PUT /k/v1/record.json のレスポンスにはidが含まれないため、呼び出し側で渡したidをそのまま使う
  return { id: kintoneRecordId, ...JSON.parse(text) };
}

// 指定されたkintoneRecordIdが実際にKintone上に存在するか確認する。
// レコードが削除済み・IDが不正な場合はfalseを返し、呼び出し側で新規作成にフォールバックする。
async function kintoneRecordExists(kintoneRecordId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://${KINTONE_DOMAIN}/k/v1/record.json?app=${KINTONE_APP_ID}&id=${encodeURIComponent(kintoneRecordId)}`,
      { headers: { "X-Cybozu-API-Token": KINTONE_API_TOKEN } }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!KINTONE_DOMAIN || !KINTONE_API_TOKEN || !KINTONE_APP_ID) {
      return NextResponse.json(
        { error: "Kintoneの環境変数が設定されていません（KINTONE_DOMAIN / KINTONE_API_TOKEN / KINTONE_APP_ID）" },
        { status: 500 }
      );
    }
    const body = await req.json();
    const {
      invoiceId,
      invoiceNo,
      applicantName,
      amount,
      currency,
      customer,
      fileKeys,
      kintoneRecordId,
    }: {
      invoiceId: string | number;
      invoiceNo: string;
      applicantName: string;
      amount: number;
      currency: string;
      customer: string;
      fileKeys: FileKeyEntry[];
      kintoneRecordId?: string | null;
    } = body;
    if (!invoiceNo) {
      return NextResponse.json({ error: "invoiceNoが指定されていません" }, { status: 400 });
    }
    if (!fileKeys || fileKeys.length === 0) {
      return NextResponse.json({ error: "添付するファイルがありません" }, { status: 400 });
    }
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const baseFields: Record<string, { value: any }> = {
      書類番号: { value: invoiceNo },
      Applicant: { value: applicantName || "" },
      取引先: { value: customer || "" },
      金額: { value: safeAmount },
      通貨: { value: currency || "" },
      コメント: { value: "" },
      tradedoc_id: { value: invoiceId != null ? String(invoiceId) : "" },
    };
    // 全書類を1レコードにまとめる
    const record: Record<string, { value: any }> = { ...baseFields };
    let hasAnyFile = false;
    for (const f of fileKeys) {
      const fieldCode = DOC_TYPE_TO_FIELD[f.docType];
      if (!fieldCode || !f.fileKey) continue;
      record[fieldCode] = { value: [{ fileKey: f.fileKey }] };
      hasAnyFile = true;
    }
    if (!hasAnyFile) {
      return NextResponse.json({ error: "有効な添付ファイルがありませんでした" }, { status: 400 });
    }

    // kintoneRecordIdが渡ってきて、かつ実際にKintone上に存在する場合のみ「更新」。
    // それ以外（初回送信・レコードが削除済み等）は従来通り「新規作成」。
    if (kintoneRecordId && (await kintoneRecordExists(String(kintoneRecordId)))) {
      const updated = await updateKintoneRecord(String(kintoneRecordId), record);
      return NextResponse.json({ kintoneRecordId: updated.id, updated: true });
    }

    const created = await createKintoneRecord(record);
    return NextResponse.json({ kintoneRecordId: created.id, updated: false });
  } catch (e: any) {
    console.error("Kintone送信エラー:", e);
    return NextResponse.json({ error: e.message || "不明なエラー" }, { status: 500 });
  }
}
