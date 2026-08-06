import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const KINTONE_DOMAIN = process.env.KINTONE_DOMAIN || "";
const KINTONE_API_TOKEN = process.env.KINTONE_API_TOKEN || "";
const KINTONE_APP_ID = process.env.KINTONE_APP_ID || "";

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
    }: {
      invoiceId: string | number;
      invoiceNo: string;
      applicantName: string;
      amount: number;
      currency: string;
      customer: string;
      fileKeys: FileKeyEntry[];
    } = body;

    if (!invoiceNo) {
      return NextResponse.json({ error: "invoiceNoが指定されていません" }, { status: 400 });
    }

    // アップロード済みfileKeyを各添付ファイルフィールドに割り当て
    const fileFieldValues: Record<string, { value: { fileKey: string }[] }> = {};
    for (const f of fileKeys || []) {
      const fieldCode = DOC_TYPE_TO_FIELD[f.docType];
      if (!fieldCode || !f.fileKey) continue;
      fileFieldValues[fieldCode] = { value: [{ fileKey: f.fileKey }] };
    }

    const record: Record<string, { value: any }> = {
      書類番号: { value: invoiceNo },
      作成者: { value: applicantName || "" },
      取引先: { value: customer || "" },
      金額: { value: amount ?? 0 },
      通貨: { value: currency || "" },
      コメント: { value: "" },
      tradedoc_id: { value: invoiceId != null ? String(invoiceId) : "" },
      ...fileFieldValues,
    };

    const createRes = await fetch(`https://${KINTONE_DOMAIN}/k/v1/record.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cybozu-API-Token": KINTONE_API_TOKEN,
      },
      body: JSON.stringify({
        app: KINTONE_APP_ID,
        record,
      }),
    });

    const createText = await createRes.text();
    if (!createRes.ok) {
      console.error("Kintoneレコード作成失敗:", createText);
      return NextResponse.json(
        { error: `Kintoneレコード作成失敗: ${createText}` },
        { status: 502 }
      );
    }

    const createData = JSON.parse(createText);

    return NextResponse.json({ kintoneRecordId: createData.id });
  } catch (e: any) {
    console.error("Kintone送信エラー:", e);
    return NextResponse.json({ error: e.message || "不明なエラー" }, { status: 500 });
  }
}
