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

// メールアドレス → Kintoneログイン名（code）の対応表。
// Kintoneのユーザー選択フィールドはメールアドレスではなくログイン名でしか値を設定できないため、
// ここで変換してからレコードに反映する。
// APIトークンにユーザー一覧取得の権限がなくても確実に動くよう、対応表を直接持たせる方式にしている。
// 新しい申請者・承認者が増えたら、ここに1行追加するだけでよい。
const APPLICANT_EMAIL_TO_LOGIN_NAME: Record<string, string> = {
  "c-ohishi@menicon.co.jp": "c-ohishi", // ← 実際のKintoneログイン名と一致しているか要確認
  "y-amamitsu@menicon.co.jp": "y-amamitsu", // ← 同上
  "k-kawaminami@menicon.co.jp": "k-kawaminami", // ← 同上
  "k-nishii@menicon.co.jp": "k-nishii", // ← 同上
  // "someone@menicon.co.jp": "someone-login",
};

function getKintoneLoginName(email: string): string | null {
  if (!email) return null;
  return APPLICANT_EMAIL_TO_LOGIN_NAME[email.toLowerCase()] || APPLICANT_EMAIL_TO_LOGIN_NAME[email] || null;
}

// 書類番号（INV番号）で既存のKintoneレコードを検索する。
// tradedoc側が保持しているkintoneRecordIdの引き継ぎが何らかの理由で途切れても、
// 同じINV番号のレコードが既にあれば必ずそちらを上書きするための仕組み。
async function findKintoneRecordIdByInvoiceNo(invoiceNo: string): Promise<string | null> {
  const escaped = invoiceNo.replace(/"/g, '\\"');
  const query = `書類番号 = "${escaped}"`;
  const url = `https://${KINTONE_DOMAIN}/k/v1/records.json?app=${encodeURIComponent(
    KINTONE_APP_ID
  )}&query=${encodeURIComponent(query)}&fields[0]=$id&totalCount=false`;
  try {
    const res = await fetch(url, { headers: { "X-Cybozu-API-Token": KINTONE_API_TOKEN } });
    if (!res.ok) {
      console.error("Kintone書類番号検索失敗:", await res.text());
      return null;
    }
    const { records } = await res.json();
    if (records && records.length > 0) {
      return String(records[0].$id.value);
    }
    return null;
  } catch (e) {
    console.error("Kintone書類番号検索エラー:", e);
    return null;
  }
}

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

    // applicantNameはフロントエンドからメールアドレスとして渡ってくるため、
    // Kintone側のログイン名（code）に変換する。
    // ※ Kintoneアプリ側で「applicant_user」というユーザー選択フィールドを
    //   あらかじめ作成しておく必要がある（まだの場合は下のuserFieldブロックはスキップされ、
    //   従来通りApplicant欄にメールアドレスが入るだけになる）。
    const applicantLoginName = getKintoneLoginName(applicantName);

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

    // ログイン名が特定できた場合のみ、ユーザー選択フィールドにも値を設定する。
    // フィールドコードは実際にKintone側で作成したものに合わせて変更すること。
    if (applicantLoginName) {
      record["applicant_user"] = { value: [{ code: applicantLoginName }] };
    } else {
      console.warn(
        `Kintoneユーザーが見つからずapplicant_userを設定できませんでした（email: ${applicantName}）`
      );
    }

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

    // ① まず書類番号（INV番号）で既存レコードを検索する。
    // 同じINV番号のレコードが既にKintone上にあれば、tradedoc側のkintoneRecordId状態に
    // 関わらず必ずそのレコードを上書きする（承認差し戻し後の再送信などで
    // 別レコードが新規作成されてしまう問題への対策）。
    const existingIdByInvoiceNo = await findKintoneRecordIdByInvoiceNo(invoiceNo);
    if (existingIdByInvoiceNo) {
      const updated = await updateKintoneRecord(existingIdByInvoiceNo, record);
      return NextResponse.json({ kintoneRecordId: updated.id, updated: true });
    }

    // ② 書類番号で見つからなかった場合のフォールバック：
    // kintoneRecordIdが渡ってきて、かつ実際にKintone上に存在する場合のみ「更新」。
    if (kintoneRecordId && (await kintoneRecordExists(String(kintoneRecordId)))) {
      const updated = await updateKintoneRecord(String(kintoneRecordId), record);
      return NextResponse.json({ kintoneRecordId: updated.id, updated: true });
    }

    // ③ どちらにも該当しなければ新規作成
    const created = await createKintoneRecord(record);
    return NextResponse.json({ kintoneRecordId: created.id, updated: false });
  } catch (e: any) {
    console.error("Kintone送信エラー:", e);
    return NextResponse.json({ error: e.message || "不明なエラー" }, { status: 500 });
  }
}
