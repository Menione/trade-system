"use client";

import { useState, useEffect, useMemo } from "react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Holds the logged-in user's access token so sb() can send it instead of the anon key.
// Withoaut this, every write was sent as the anon key and silently failed against
// anya RLS policy that checks auth.uid() / role = authenticated.
let currentUserToken = "";
let currentRefreshToken = "";

// ── Supabase helpers ─────────────────────────────────────────
async function signIn(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error_description || "ログイン失敗");
  return d;
}

async function signOut(token: string) {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
  } catch (e) {}
}

async function getUser(token: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// Access tokens expire after ~1 hour. This exchanges the long-lived refresh token
// for a fresh access token so sessions don't die mid-use with "JWT expired".
async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error_description || "トークンの更新に失敗しました");
  return d;
}

function applyNewSession(d: any) {
  currentUserToken = d.access_token;
  currentRefreshToken = d.refresh_token || currentRefreshToken;
  localStorage.setItem("po_token", currentUserToken);
  localStorage.setItem("po_refresh_token", currentRefreshToken);
}

async function sb(path: string, options: any = {}, _retry = true): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${currentUserToken || SUPABASE_ANON_KEY}`,
      Prefer: options.method === "POST" || options.method === "PATCH" ? "return=representation" : "",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    const isExpired = res.status === 401 && /jwt expired|pgrst303/i.test(errText);
    if (isExpired && _retry && currentRefreshToken) {
      try {
        applyNewSession(await refreshAccessToken(currentRefreshToken));
        return sb(path, options, false);
      } catch (e) {
        // fall through to throw the original error below
      }
    }
    throw new Error(errText);
  }
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

function asArray(v: any) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

const uid = () => Date.now() + Math.random();

const CURRENCIES = ["JPY", "USD", "EUR", "GBP"];

const INIT_ITEM = { id: uid(), itemNo: "", name: "", unitPrice: 0, qty: 0 };

const INIT_PO: any = {
  poNumber: "",
  date: new Date().toISOString().split("T")[0],
  supplierId: "",
  supplierSnapshot: null,
  currency: "EUR",
  paymentTerms: "Net 30 days since the invoice date.",
  deliveryDate: "as soon as possible",
  shippingMethod: "",
  shippingAccount: "",
  jastproCode: "",
  notes: "",
  items: [{ ...INIT_ITEM, id: uid() }],
  status: "draft",
  shipToId: "",
  shipToSnapshot: null,
};

const INIT_SUPPLIER: any = {
  name: "", address: "", tel: "", fax: "", email: "", attn: "",
  shipToName: "", shipToAddress: "", shipToTel: "", shipToAttn: "",
};

const INIT_SHIPTO: any = { name: "", address: "", tel: "", attn: "" };
const INIT_PRODUCT: any = { supplierId: "", itemNo: "", name: "", unitPrice: 0 };

const INIT_ORG: any = {
  companyName: "Meni-one Co., Ltd.", address: "", tel: "", fax: "",
  billToName: "", billToAddress: "", billToTel: "", billToAttn: "",
  signerName: "", logoBase64: "", signatureBase64: "", attachmentBase64: "",
  shipTos: [] as any[],
};

// ── Image upload helper: converts a picked file into a base64 data URL ──────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}

const css = `
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, "Segoe UI", "Hiragino Kaku Gothic ProN", sans-serif; }
.app { display: flex; min-height: 100vh; background: #f4f5f7; }
.sidebar { width: 220px; background: #1a1a2e; color: #fff; display: flex; flex-direction: column; }
.sidebar-title { padding: 20px 16px; font-weight: 800; font-size: 16px; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.nav-item { padding: 12px 16px; cursor: pointer; font-size: 13px; color: rgba(255,255,255,0.75); }
.nav-item:hover { background: rgba(255,255,255,0.06); }
.nav-item.active { background: rgba(255,255,255,0.14); color: #fff; font-weight: 600; border-left: 3px solid #4ade80; }
.main { flex: 1; padding: 24px 32px; overflow-x: auto; }
.card { background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 16px; }
h1 { font-size: 20px; margin: 0 0 16px; }
h2 { font-size: 15px; margin: 0 0 12px; color: #1a1a2e; }
label { display: block; font-size: 12px; font-weight: 600; color: #555; margin-bottom: 4px; }
input, select, textarea { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; font-family: inherit; }
textarea { resize: vertical; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px; }
.row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 14px; }
.field { margin-bottom: 14px; }
.btn { padding: 9px 16px; border-radius: 6px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-primary { background: #1a1a2e; color: #fff; }
.btn-green { background: #16a34a; color: #fff; }
.btn-red { background: #fff; color: #dc2626; border: 1px solid #dc2626; }
.btn-secondary { background: #eee; color: #333; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { border: 1px solid #e2e2e2; padding: 6px 8px; text-align: left; }
th { background: #f8f8fb; font-size: 11px; color: #555; }
.toast { position: fixed; bottom: 20px; right: 20px; background: #1a1a2e; color: #fff; padding: 10px 18px; border-radius: 8px; font-size: 13px; z-index: 999; }
.pill { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; background: #eee; }
.list-item { padding: 10px 12px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
.list-item:hover { background: #f8f8fb; }

/* ── print / PDF layout ── */
.po-sheet { background: #fff; padding: 32px; width: 780px; margin: 0 auto; font-size: 13px; color: #111; }
.po-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a1a2e; padding-bottom: 10px; margin-bottom: 14px; }
.po-title { font-size: 26px; letter-spacing: 2px; color: #888; font-weight: 700; }
.po-meta-table td { border: none; padding: 4px 10px; font-size: 12px; }
.po-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 14px; }
.po-parties .label { font-weight: 700; margin-bottom: 2px; }
.po-items th, .po-items td { border: 1px solid #333; }
.po-items th { background: #d9d9d9; text-align: center; }
.po-items td.num { text-align: right; }
.po-items td.center { text-align: center; }
.po-total-row td { font-weight: 700; }
.po-notes { margin-top: 16px; font-size: 12px; }
.po-sign { margin-top: 40px; text-align: right; }
@media print {
  .no-print { display: none !important; }
  .po-sheet { width: 100%; box-shadow: none; }
  body { background: #fff; }
}
`;

// ── Login ─────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (t: string, u: any) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const d = await signIn(email, password);
      localStorage.setItem("po_token", d.access_token);
      localStorage.setItem("po_refresh_token", d.refresh_token || "");
      onLogin(d.access_token, d.user);
    } catch (err: any) {
      setError(err.message || "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e" }}>PO Manager</div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>発注書(Purchase Order)管理システム</div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label>メールアドレス</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label>パスワード</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin(e)} placeholder="••••••••" />
        </div>
        {error && <div style={{ background: "#FEF2F2", color: "#DC2626", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>❌ {error}</div>}
        <button className="btn btn-primary" style={{ width: "100%", padding: 12 }} onClick={handleLogin} disabled={loading || !email || !password}>
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </div>
    </div>
  );
}

// ── PO Items editor ─────────────────────────────────────────
function ItemsEditor({ items, setItems, products }: { items: any[]; setItems: (v: any[]) => void; products?: any[] }) {
  const update = (id: number, field: string, val: any) => setItems(items.map((it) => (it.id === id ? { ...it, [field]: val } : it)));
  const remove = (id: number) => setItems(items.filter((it) => it.id !== id));
  const add = () => setItems([...items, { ...INIT_ITEM, id: uid() }]);
  const addFromProduct = (productId: string) => {
    if (!productId) return;
    const p = (products || []).find((p: any) => p.id === productId);
    if (!p) return;
    setItems([...items, { id: uid(), itemNo: p.item_no || "", name: p.name || "", unitPrice: p.unit_price || 0, qty: 0 }]);
  };
  const total = items.reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 0), 0);

  return (
    <div>
      {products && products.length > 0 && (
        <div className="field" style={{ maxWidth: 360 }}>
          <label>登録商品から追加</label>
          <select value="" onChange={(e) => addFromProduct(e.target.value)}>
            <option value="">-- 商品を選択して追加 --</option>
            {products.map((p: any) => (
              <option key={p.id} value={p.id}>{p.item_no ? p.item_no + " " : ""}{p.name}</option>
            ))}
          </select>
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th style={{ width: 36 }}>No.</th>
            <th style={{ width: 90 }}>品番</th>
            <th>品名</th>
            <th style={{ width: 100 }}>単価</th>
            <th style={{ width: 80 }}>数量</th>
            <th style={{ width: 100 }}>小計</th>
            <th style={{ width: 30 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id}>
              <td>{i + 1}</td>
              <td><input value={it.itemNo} onChange={(e) => update(it.id, "itemNo", e.target.value)} /></td>
              <td><input value={it.name} onChange={(e) => update(it.id, "name", e.target.value)} /></td>
              <td><input type="number" value={it.unitPrice} onChange={(e) => update(it.id, "unitPrice", e.target.value)} /></td>
              <td><input type="number" value={it.qty} onChange={(e) => update(it.id, "qty", e.target.value)} /></td>
              <td style={{ textAlign: "right" }}>{((Number(it.unitPrice) || 0) * (Number(it.qty) || 0)).toFixed(2)}</td>
              <td><span style={{ cursor: "pointer", color: "#dc2626" }} onClick={() => remove(it.id)}>✕</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="btn btn-secondary" onClick={add}>＋ 品目追加（手入力）</button>
        <div style={{ fontWeight: 700 }}>合計: {total.toFixed(2)}</div>
      </div>
    </div>
  );
}

// ── New PO Page ─────────────────────────────────────────
function NewPOPage({ po, setPo, suppliers, products, org, onSave, saving }: any) {
  const supplier = suppliers.find((s: any) => s.id === po.supplierId);
  const shipTos = org?.shipTos || [];
  const supplierProducts = (products || []).filter((p: any) => p.supplier_id === po.supplierId);

  const selectSupplier = (id: string) => {
    const s = suppliers.find((s: any) => s.id === id);
    setPo({
      ...po,
      supplierId: id,
      supplierSnapshot: s
        ? { name: s.name, address: s.address, tel: s.tel, attn: s.attn, shipToName: s.shipToName, shipToAddress: s.shipToAddress, shipToTel: s.shipToTel, shipToAttn: s.shipToAttn }
        : null,
    });
  };

  const selectShipTo = (id: string) => {
    const st = shipTos.find((s: any) => s._id === id || String(s._id) === id);
    setPo({ ...po, shipToId: id, shipToSnapshot: st ? { name: st.name, address: st.address, tel: st.tel, attn: st.attn } : null });
  };

  return (
    <div>
      <div className="card">
        <h2>発注先</h2>
        <div className="field">
          <label>発注先を選択</label>
          <select value={po.supplierId} onChange={(e) => selectSupplier(e.target.value)}>
            <option value="">-- 選択してください --</option>
            {suppliers.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        {supplier && (
          <div style={{ fontSize: 12, color: "#555", background: "#f8f8fb", padding: 10, borderRadius: 6 }}>
            <div><strong>To:</strong> {supplier.name} / {supplier.address}</div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>納品先 (Ship To)</h2>
        <div className="field">
          <label>納品先を選択（注文者と異なる場合）</label>
          <select value={po.shipToId} onChange={(e) => selectShipTo(e.target.value)}>
            <option value="">-- 自社住所（デフォルト）を使用 --</option>
            {shipTos.map((st: any) => (
              <option key={st._id} value={st._id}>{st.name}</option>
            ))}
          </select>
        </div>
        {po.shipToSnapshot && (
          <div style={{ fontSize: 12, color: "#555", background: "#f8f8fb", padding: 10, borderRadius: 6 }}>
            <div><strong>Ship To:</strong> {po.shipToSnapshot.name} / {po.shipToSnapshot.address}</div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>基本情報</h2>
        <div className="row3">
          <div className="field"><label>PO Number</label><input value={po.poNumber} onChange={(e) => setPo({ ...po, poNumber: e.target.value })} /></div>
          <div className="field"><label>Date</label><input type="date" value={po.date} onChange={(e) => setPo({ ...po, date: e.target.value })} /></div>
          <div className="field"><label>通貨</label>
            <select value={po.currency} onChange={(e) => setPo({ ...po, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field"><label>支払条件</label><input value={po.paymentTerms} onChange={(e) => setPo({ ...po, paymentTerms: e.target.value })} /></div>
          <div className="field"><label>納期</label><input value={po.deliveryDate} onChange={(e) => setPo({ ...po, deliveryDate: e.target.value })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>発送方法</label><input value={po.shippingMethod} onChange={(e) => setPo({ ...po, shippingMethod: e.target.value })} placeholder="例: via FedEx" /></div>
          <div className="field"><label>発送アカウント番号</label><input value={po.shippingAccount} onChange={(e) => setPo({ ...po, shippingAccount: e.target.value })} /></div>
        </div>
        <div className="field"><label>JASTPROコード</label><input value={po.jastproCode} onChange={(e) => setPo({ ...po, jastproCode: e.target.value })} /></div>
        <div className="field"><label>備考(Please Note)</label><textarea rows={3} value={po.notes} onChange={(e) => setPo({ ...po, notes: e.target.value })} /></div>
      </div>

      <div className="card">
        <h2>品目</h2>
        <ItemsEditor items={po.items} setItems={(items: any[]) => setPo({ ...po, items })} products={supplierProducts} />
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn-secondary" disabled={saving} onClick={() => onSave("draft")}>💾 下書き保存</button>
        <button className="btn btn-primary" disabled={saving || !po.supplierId} onClick={() => onSave("confirmed")}>✅ 発注書として保存</button>
      </div>
    </div>
  );
}

// ── Suppliers Page ─────────────────────────────────────────
function SuppliersPage({ suppliers, reload, showToast }: any) {
  const [editing, setEditing] = useState<any>(null);

  const save = async () => {
    try {
      const payload = {
        name: editing.name, address: editing.address, tel: editing.tel, fax: editing.fax, email: editing.email, attn: editing.attn,
        ship_to_name: editing.shipToName, ship_to_address: editing.shipToAddress, ship_to_tel: editing.shipToTel, ship_to_attn: editing.shipToAttn,
      };
      if (editing.id) {
        await sb(`suppliers?id=eq.${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await sb("suppliers", { method: "POST", body: JSON.stringify(payload) });
      }
      setEditing(null);
      reload();
      showToast("💾 発注先を保存しました");
    } catch (e: any) {
      showToast("❌ 保存に失敗しました: " + (e.message || "").slice(0, 120));
    }
  };

  const del = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await sb(`suppliers?id=eq.${id}`, { method: "DELETE" });
    reload();
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>発注先一覧</h2>
          <button className="btn btn-primary" onClick={() => setEditing({ ...INIT_SUPPLIER })}>＋ 新規登録</button>
        </div>
        {suppliers.length === 0 && <div style={{ color: "#888", fontSize: 13 }}>まだ登録がありません</div>}
        {suppliers.map((s: any) => (
          <div key={s.id} className="list-item">
            <div>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{s.address}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setEditing({ id: s.id, ...s })}>編集</button>
              <button className="btn btn-red" onClick={() => del(s.id)}>削除</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="card">
          <h2>{editing.id ? "発注先を編集" : "発注先を新規登録"}</h2>
          <div className="row">
            <div className="field"><label>会社名 (To)</label><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="field"><label>担当者 (Attn)</label><input value={editing.attn} onChange={(e) => setEditing({ ...editing, attn: e.target.value })} /></div>
          </div>
          <div className="field"><label>住所</label><textarea rows={2} value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
          <div className="row">
            <div className="field"><label>電話</label><input value={editing.tel} onChange={(e) => setEditing({ ...editing, tel: e.target.value })} /></div>
            <div className="field"><label>メール</label><input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
          </div>
          <h2 style={{ marginTop: 16 }}>Ship To (出荷先・異なる場合)</h2>
          <div className="row">
            <div className="field"><label>会社名</label><input value={editing.shipToName} onChange={(e) => setEditing({ ...editing, shipToName: e.target.value })} /></div>
            <div className="field"><label>担当者</label><input value={editing.shipToAttn} onChange={(e) => setEditing({ ...editing, shipToAttn: e.target.value })} /></div>
          </div>
          <div className="field"><label>住所</label><textarea rows={2} value={editing.shipToAddress} onChange={(e) => setEditing({ ...editing, shipToAddress: e.target.value })} /></div>
          <div className="field"><label>電話</label><input value={editing.shipToTel} onChange={(e) => setEditing({ ...editing, shipToTel: e.target.value })} /></div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>キャンセル</button>
            <button className="btn btn-primary" onClick={save}>保存</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Products Page (発注先ごとの商品登録) ─────────────────────────────────
function ProductsPage({ products, suppliers, reload, showToast }: any) {
  const [supplierId, setSupplierId] = useState("");
  const [editing, setEditing] = useState<any>(null);

  const list = products.filter((p: any) => p.supplier_id === supplierId);

  const save = async () => {
    try {
      const payload = { supplier_id: supplierId, item_no: editing.itemNo, name: editing.name, unit_price: Number(editing.unitPrice) || 0 };
      if (editing.id) {
        await sb(`products?id=eq.${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await sb("products", { method: "POST", body: JSON.stringify(payload) });
      }
      setEditing(null);
      reload();
      showToast("💾 商品を保存しました");
    } catch (e: any) {
      showToast("❌ 保存に失敗しました: " + (e.message || "").slice(0, 120));
    }
  };

  const del = async (id: string) => {
    if (!confirm("この商品を削除しますか？")) return;
    try {
      await sb(`products?id=eq.${id}`, { method: "DELETE" });
      reload();
      showToast("🗑️ 削除しました");
    } catch (e: any) {
      showToast("❌ 削除に失敗しました: " + (e.message || "").slice(0, 120));
    }
  };

  return (
    <div>
      <div className="card">
        <h2>発注先を選択</h2>
        <div className="field" style={{ maxWidth: 360 }}>
          <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setEditing(null); }}>
            <option value="">-- 発注先を選択してください --</option>
            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {supplierId && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>商品一覧</h2>
            <button className="btn btn-primary" onClick={() => setEditing({ ...INIT_PRODUCT })}>＋ 新規登録</button>
          </div>
          {list.length === 0 && <div style={{ color: "#888", fontSize: 13 }}>まだ登録がありません</div>}
          {list.map((p: any) => (
            <div key={p.id} className="list-item">
              <div>
                <div style={{ fontWeight: 600 }}>{p.item_no ? p.item_no + " " : ""}{p.name}</div>
                <div style={{ fontSize: 12, color: "#888" }}>単価: {p.unit_price}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setEditing({ id: p.id, itemNo: p.item_no, name: p.name, unitPrice: p.unit_price })}>編集</button>
                <button className="btn btn-red" onClick={() => del(p.id)}>削除</button>
              </div>
            </div>
          ))}

          {editing && (
            <div className="card" style={{ background: "#f8f8fb", marginTop: 12 }}>
              <h2>{editing.id ? "商品を編集" : "商品を新規登録"}</h2>
              <div className="row3">
                <div className="field"><label>品番</label><input value={editing.itemNo} onChange={(e) => setEditing({ ...editing, itemNo: e.target.value })} /></div>
                <div className="field"><label>品名</label><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div className="field"><label>単価</label><input type="number" value={editing.unitPrice} onChange={(e) => setEditing({ ...editing, unitPrice: e.target.value })} /></div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setEditing(null)}>キャンセル</button>
                <button className="btn btn-primary" onClick={save}>保存</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── History Page ─────────────────────────────────────────
function HistoryPage({ pos, suppliers, onLoad, onDelete }: any) {
  const [supplierFilter, setSupplierFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = pos.filter((p: any) => {
    if (supplierFilter && p.supplier_id !== supplierFilter) return false;
    if (from && p.date < from) return false;
    if (to && p.date > to) return false;
    return true;
  });

  const supplierName = (id: string) => suppliers.find((s: any) => s.id === id)?.name || "(不明)";

  return (
    <div className="card">
      <h2>保存済み発注書</h2>
      <div className="row3" style={{ marginBottom: 12 }}>
        <div className="field"><label>発注先で絞込</label>
          <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
            <option value="">すべて</option>
            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field"><label>開始日</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label>終了日</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      {filtered.length === 0 && <div style={{ color: "#888", fontSize: 13 }}>該当する発注書がありません</div>}
      {filtered.map((p: any) => {
        const total = asArray(p.items).reduce((s: number, it: any) => s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 0), 0);
        return (
          <div key={p.id} className="list-item" onClick={() => onLoad(p)}>
            <div>
              <div style={{ fontWeight: 600 }}>{p.po_number || "(番号未設定)"} <span className="pill">{p.status === "confirmed" ? "確定" : "下書き"}</span></div>
              <div style={{ fontSize: 12, color: "#888" }}>{p.date} / {supplierName(p.supplier_id)} / {p.currency} {total.toFixed(2)}</div>
            </div>
            <button className="btn btn-red" onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}>削除</button>
          </div>
        );
      })}
    </div>
  );
}

// ── Quantity Report Page (期間指定で発注数を集計) ─────────────────────
function ReportPage({ pos, suppliers }: any) {
  const today = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [supplierFilter, setSupplierFilter] = useState("");

  const rows = useMemo(() => {
    const inRange = pos.filter((p: any) => p.date >= from && p.date <= to && (!supplierFilter || p.supplier_id === supplierFilter));
    const map: Record<string, { itemNo: string; name: string; qty: number; total: number }> = {};
    inRange.forEach((p: any) => {
      asArray(p.items).forEach((it: any) => {
        const key = (it.itemNo || "") + "|" + (it.name || "");
        if (!map[key]) map[key] = { itemNo: it.itemNo, name: it.name, qty: 0, total: 0 };
        map[key].qty += Number(it.qty) || 0;
        map[key].total += (Number(it.unitPrice) || 0) * (Number(it.qty) || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }, [pos, from, to, supplierFilter]);

  const grandQty = rows.reduce((s, r) => s + r.qty, 0);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="card">
      <h2>期間別 発注数量レポート</h2>
      <div className="row3" style={{ marginBottom: 16 }}>
        <div className="field"><label>開始日</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label>終了日</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="field"><label>発注先</label>
          <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
            <option value="">すべて</option>
            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <table>
        <thead><tr><th>品番</th><th>品名</th><th style={{ width: 100 }}>合計数量</th><th style={{ width: 120 }}>合計金額</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}><td>{r.itemNo}</td><td>{r.name}</td><td style={{ textAlign: "right" }}>{r.qty}</td><td style={{ textAlign: "right" }}>{r.total.toFixed(2)}</td></tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "#888" }}>該当データなし</td></tr>}
        </tbody>
        {rows.length > 0 && (
          <tfoot><tr style={{ fontWeight: 700 }}><td colSpan={2}>合計</td><td style={{ textAlign: "right" }}>{grandQty}</td><td style={{ textAlign: "right" }}>{grandTotal.toFixed(2)}</td></tr></tfoot>
        )}
      </table>
    </div>
  );
}

// ── Reusable image upload field (logo / signature / attachment) ─────────────
function ImageUploadField({ label, value, onChange, height = 80 }: { label: string; value: string; onChange: (v: string) => void; height?: number }) {
  const [error, setError] = useState("");
  const handleFile = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("画像ファイルを選択してください"); return; }
    if (file.size > 2 * 1024 * 1024) { setError("2MB以下の画像を選択してください"); return; }
    try {
      setError("");
      const b64 = await fileToBase64(file);
      onChange(b64);
    } catch (err: any) {
      setError(err.message || "読み込みに失敗しました");
    }
  };
  return (
    <div className="field">
      <label>{label}</label>
      {value ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={value} alt={label} style={{ height, maxWidth: 200, objectFit: "contain", border: "1px solid #ddd", borderRadius: 6, padding: 4, background: "#fff" }} />
          <button className="btn btn-secondary" type="button" onClick={() => onChange("")}>削除</button>
        </div>
      ) : (
        <input type="file" accept="image/*" onChange={handleFile} />
      )}
      {error && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// ── Org settings ─────────────────────────────────────────
function OrgPage({ org, setOrg, save }: any) {
  const [editingShipTo, setEditingShipTo] = useState<any>(null);

  const saveShipTo = () => {
    if (!editingShipTo.name) return;
    const list = org.shipTos || [];
    if (editingShipTo._id) {
      setOrg({ ...org, shipTos: list.map((st: any) => (st._id === editingShipTo._id ? editingShipTo : st)) });
    } else {
      setOrg({ ...org, shipTos: [...list, { ...editingShipTo, _id: uid() }] });
    }
    setEditingShipTo(null);
  };

  const deleteShipTo = (id: number) => {
    if (!confirm("この納品先を削除しますか？")) return;
    setOrg({ ...org, shipTos: (org.shipTos || []).filter((st: any) => st._id !== id) });
  };

  return (
    <div className="card">
      <h2>自社情報 (発行元 / Bill To)</h2>
      <div className="row">
        <div className="field"><label>会社名</label><input value={org.companyName} onChange={(e) => setOrg({ ...org, companyName: e.target.value })} /></div>
        <div className="field"><label>署名者名</label><input value={org.signerName} onChange={(e) => setOrg({ ...org, signerName: e.target.value })} /></div>
      </div>
      <div className="field"><label>住所</label><textarea rows={2} value={org.address} onChange={(e) => setOrg({ ...org, address: e.target.value })} /></div>
      <div className="row">
        <div className="field"><label>電話</label><input value={org.tel} onChange={(e) => setOrg({ ...org, tel: e.target.value })} /></div>
        <div className="field"><label>FAX</label><input value={org.fax} onChange={(e) => setOrg({ ...org, fax: e.target.value })} /></div>
      </div>
      <h2 style={{ marginTop: 20 }}>Bill To (請求先・注文元が異なる場合)</h2>
      <div className="field"><label>会社名</label><input value={org.billToName} onChange={(e) => setOrg({ ...org, billToName: e.target.value })} /></div>
      <div className="field"><label>住所</label><textarea rows={2} value={org.billToAddress} onChange={(e) => setOrg({ ...org, billToAddress: e.target.value })} /></div>
      <div className="row">
        <div className="field"><label>電話</label><input value={org.billToTel} onChange={(e) => setOrg({ ...org, billToTel: e.target.value })} /></div>
        <div className="field"><label>担当者</label><input value={org.billToAttn} onChange={(e) => setOrg({ ...org, billToAttn: e.target.value })} /></div>
      </div>

      <h2 style={{ marginTop: 20 }}>ロゴ・署名・添付画像</h2>
      <div className="row">
        <ImageUploadField label="自社ロゴ" value={org.logoBase64} onChange={(v) => setOrg({ ...org, logoBase64: v })} />
        <ImageUploadField label="発注責任者の署名 (サイン)" value={org.signatureBase64} onChange={(v) => setOrg({ ...org, signatureBase64: v })} />
      </div>
      <ImageUploadField label="添付写真 (社印など)" value={org.attachmentBase64} onChange={(v) => setOrg({ ...org, attachmentBase64: v })} />

      <h2 style={{ marginTop: 20 }}>Ship To (納品先) — 注文者と別の場合に登録・選択</h2>
      {(org.shipTos || []).length === 0 && <div style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>まだ納品先が登録されていません（未登録の場合、自社住所が納品先として使われます）</div>}
      {(org.shipTos || []).map((st: any) => (
        <div key={st._id} className="list-item">
          <div>
            <div style={{ fontWeight: 600 }}>{st.name}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{st.address}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setEditingShipTo(st)}>編集</button>
            <button className="btn btn-red" onClick={() => deleteShipTo(st._id)}>削除</button>
          </div>
        </div>
      ))}
      <div style={{ margin: "10px 0" }}>
        <button className="btn btn-secondary" onClick={() => setEditingShipTo({ ...INIT_SHIPTO })}>＋ 納品先を追加</button>
      </div>
      {editingShipTo && (
        <div className="card" style={{ background: "#f8f8fb" }}>
          <div className="row">
            <div className="field"><label>納品先名</label><input value={editingShipTo.name} onChange={(e) => setEditingShipTo({ ...editingShipTo, name: e.target.value })} /></div>
            <div className="field"><label>担当者</label><input value={editingShipTo.attn} onChange={(e) => setEditingShipTo({ ...editingShipTo, attn: e.target.value })} /></div>
          </div>
          <div className="field"><label>住所</label><textarea rows={2} value={editingShipTo.address} onChange={(e) => setEditingShipTo({ ...editingShipTo, address: e.target.value })} /></div>
          <div className="field"><label>電話</label><input value={editingShipTo.tel} onChange={(e) => setEditingShipTo({ ...editingShipTo, tel: e.target.value })} /></div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => setEditingShipTo(null)}>キャンセル</button>
            <button className="btn btn-primary" onClick={saveShipTo}>この納品先を保存</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary" onClick={save}>保存</button>
      </div>
    </div>
  );
}

// ── PDF/Print Preview ─────────────────────────────────────────
function POPrintView({ po, org }: any) {
  const s = po.supplierSnapshot || {};
  const total = po.items.reduce((sum: number, it: any) => sum + (Number(it.unitPrice) || 0) * (Number(it.qty) || 0), 0);
  const totalQty = po.items.reduce((sum: number, it: any) => sum + (Number(it.qty) || 0), 0);
  const curSymbol: any = { JPY: "¥", USD: "$", EUR: "€", GBP: "£" };
  const sym = curSymbol[po.currency] || "";

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 12, textAlign: "right" }}>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨️ PDF出力 / 印刷</button>
      </div>
      <div className="po-sheet" id="print-area">
        <div className="po-head">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {org.logoBase64 && <img src={org.logoBase64} alt="logo" style={{ height: 44, objectFit: "contain" }} />}
          </div>
          <div className="po-title">PURCHASE ORDER</div>
        </div>
        <table className="po-meta-table" style={{ float: "right", marginBottom: 10 }}>
          <tbody>
            <tr><td>Date</td><td>{po.date}</td></tr>
            <tr><td>PO number</td><td>{po.poNumber}</td></tr>
          </tbody>
        </table>
        <div style={{ fontSize: 12, marginBottom: 10 }}>
          {org.address}<br />TEL. {org.tel} {org.fax && <>Fax. {org.fax}</>}
        </div>
        <div style={{ clear: "both" }} />

        <div className="po-parties">
          <div>
            <div className="label">To:</div>
            <div>{s.name}</div><div>{s.address}</div><div>Tel: {s.tel}</div>
            <div className="label" style={{ marginTop: 8 }}>Attn:</div><div>{s.attn}</div>
          </div>
          <div>
            <div className="label">Ship To:</div>
            <div>{po.shipToSnapshot?.name || org.companyName}</div>
            <div>{po.shipToSnapshot?.address || org.address}</div>
            <div>{po.shipToSnapshot?.tel || org.tel}</div>
            <div className="label" style={{ marginTop: 8 }}>Attn:</div><div>{po.shipToSnapshot?.attn}</div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div className="label">Bill To:</div>
          <div>{org.billToName || org.companyName}</div>
          <div>{org.billToAddress || org.address}</div>
          <div>TEL. {org.billToTel || org.tel}</div>
          <div className="label" style={{ marginTop: 8 }}>Attn:</div><div>{org.billToAttn}</div>
        </div>

        <table className="po-items">
          <thead><tr><th style={{ width: 30 }}>No.</th><th>Item</th><th style={{ width: 80 }}>Unit Price</th><th style={{ width: 60 }}>QTY</th><th style={{ width: 90 }}>Total</th></tr></thead>
          <tbody>
            {po.items.map((it: any, i: number) => (
              <tr key={it.id}>
                <td className="center">{i + 1}</td>
                <td>{it.itemNo ? it.itemNo + " " : ""}{it.name}</td>
                <td className="num">{sym} {Number(it.unitPrice).toFixed(2)}</td>
                <td className="center">{it.qty}</td>
                <td className="num">{sym} {((Number(it.unitPrice) || 0) * (Number(it.qty) || 0)).toFixed(2)}</td>
              </tr>
            ))}
            <tr className="po-total-row"><td colSpan={3} className="num">TOTAL</td><td className="center">{totalQty}</td><td className="num">{sym} {total.toFixed(2)}</td></tr>
          </tbody>
        </table>

        <div className="po-notes">
          <strong>Please Note;</strong>
          <div>1) Payment: {po.paymentTerms}</div>
          <div>2) Delivery Date: {po.deliveryDate}</div>
          {po.shippingMethod && <div>3) Shipping Method: {po.shippingMethod} {po.shippingAccount && <>, Account# is {po.shippingAccount}</>}</div>}
          {po.jastproCode && <div>4) Please record of "JASTPRO* code # {po.jastproCode}" on your invoice and shipping list.</div>}
          <div>5) Please notify us immediately if you are unable to ship as specified.</div>
          {po.notes && <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{po.notes}</div>}
          <div style={{ marginTop: 8, fontSize: 11 }}>*JASTPRO: Japan shippers consignees standard code</div>
        </div>

        <div className="po-sign">
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 12 }}>
            {org.attachmentBase64 && <img src={org.attachmentBase64} alt="seal" style={{ height: 50, objectFit: "contain" }} />}
            {org.signatureBase64 && <img src={org.signatureBase64} alt="signature" style={{ height: 40, objectFit: "contain" }} />}
          </div>
          <div>Authorized by {org.signerName} &nbsp;&nbsp; {po.date}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [page, setPage] = useState("new");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [po, setPo] = useState<any>({ ...INIT_PO });
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [org, setOrg] = useState<any>(INIT_ORG);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("po_token");
        const refreshToken = localStorage.getItem("po_refresh_token");
        if (token) {
          let user = await getUser(token);
          if (!user && refreshToken) {
            try {
              const d = await refreshAccessToken(refreshToken);
              applyNewSession(d);
              user = d.user || (await getUser(d.access_token));
              if (user) { setAuthToken(d.access_token); setAuthUser(user); }
            } catch (e) {
              localStorage.removeItem("po_token");
              localStorage.removeItem("po_refresh_token");
            }
          } else if (user) {
            setAuthToken(token); setAuthUser(user);
          } else {
            localStorage.removeItem("po_token");
          }
        }
      } catch (e) {
        localStorage.removeItem("po_token");
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Keep the module-level tokens used by sb() in sync with the logged-in user.
  useEffect(() => {
    currentUserToken = authToken || "";
    currentRefreshToken = localStorage.getItem("po_refresh_token") || "";
  }, [authToken]);

  // Proactively refresh the access token before it expires (~1hr) so a long
  // work session doesn't suddenly hit "JWT expired" on save.
  useEffect(() => {
    if (!authToken) return;
    const interval = setInterval(async () => {
      if (!currentRefreshToken) return;
      try {
        const d = await refreshAccessToken(currentRefreshToken);
        applyNewSession(d);
        setAuthToken(d.access_token);
      } catch (e) {}
    }, 45 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authToken]);

  const reloadSuppliers = () => sb("suppliers?order=name.asc").then((d) => setSuppliers(d || [])).catch(() => {});
  const reloadProducts = () => sb("products?order=item_no.asc").then((d) => setProducts(d || [])).catch(() => {});
  const reloadPos = () => sb("purchase_orders?order=date.desc").then((d) => setPos(d || [])).catch(() => {});

  useEffect(() => {
    if (!authToken) return;
    reloadSuppliers();
    reloadProducts();
    reloadPos();
    sb("organization?limit=1").then((d) => {
      if (d && d.length > 0) {
        const r = d[0];
        setOrg({
          companyName: r.company_name || "", address: r.address || "", tel: r.tel || "", fax: r.fax || "",
          billToName: r.bill_to_name || "", billToAddress: r.bill_to_address || "", billToTel: r.bill_to_tel || "",
          billToAttn: r.bill_to_attn || "", signerName: r.signer_name || "",
          logoBase64: r.logo_base64 || "", signatureBase64: r.signature_base64 || "", attachmentBase64: r.attachment_base64 || "",
          shipTos: asArray(r.ship_tos).map((st: any) => ({ ...st, _id: st._id || uid() })),
        });
      }
    }).catch((e) => showToast("❌ 自社情報の読み込みに失敗しました"));
  }, [authToken]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const saveOrg = async () => {
    try {
      const payload = {
        company_name: org.companyName, address: org.address, tel: org.tel, fax: org.fax,
        bill_to_name: org.billToName, bill_to_address: org.billToAddress, bill_to_tel: org.billToTel,
        bill_to_attn: org.billToAttn, signer_name: org.signerName,
        logo_base64: org.logoBase64, signature_base64: org.signatureBase64, attachment_base64: org.attachmentBase64,
        ship_tos: org.shipTos || [],
      };
      const existing = await sb("organization?limit=1");
      if (existing && existing.length > 0) {
        await sb(`organization?id=eq.${existing[0].id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await sb("organization", { method: "POST", body: JSON.stringify(payload) });
      }
      showToast("💾 自社情報を保存しました");
    } catch (e: any) { showToast("❌ 保存に失敗しました: " + (e.message || "").slice(0, 120)); }
  };

  const savePO = async (status: string) => {
    setSaving(true);
    try {
      const payload = {
        po_number: po.poNumber, date: po.date, supplier_id: po.supplierId,
        supplier_snapshot: po.supplierSnapshot, currency: po.currency,
        payment_terms: po.paymentTerms, delivery_date: po.deliveryDate,
        shipping_method: po.shippingMethod, shipping_account: po.shippingAccount,
        jastpro_code: po.jastproCode, notes: po.notes, items: po.items, status,
        ship_to_id: po.shipToId || null, ship_to_snapshot: po.shipToSnapshot,
      };
      if (po.dbId) {
        await sb(`purchase_orders?id=eq.${po.dbId}`, { method: "PATCH", body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }) });
      } else {
        const r = await sb("purchase_orders", { method: "POST", body: JSON.stringify(payload) });
        if (r?.[0]?.id) setPo((v: any) => ({ ...v, dbId: r[0].id }));
      }
      reloadPos();
      showToast(status === "draft" ? "💾 下書きを保存しました" : "✅ 発注書を保存しました");
    } catch (e: any) { showToast("❌ 保存に失敗しました: " + (e.message || "").slice(0, 120)); }
    setSaving(false);
  };

  const loadPO = (p: any) => {
    setPo({
      dbId: p.id, poNumber: p.po_number || "", date: p.date || "", supplierId: p.supplier_id || "",
      supplierSnapshot: p.supplier_snapshot || null, currency: p.currency || "EUR",
      paymentTerms: p.payment_terms || "", deliveryDate: p.delivery_date || "",
      shippingMethod: p.shipping_method || "", shippingAccount: p.shipping_account || "",
      jastproCode: p.jastpro_code || "", notes: p.notes || "", items: asArray(p.items), status: p.status || "draft",
      shipToId: p.ship_to_id || "", shipToSnapshot: p.ship_to_snapshot || null,
    });
    setPage("new");
  };

  const deletePO = async (id: string) => {
    if (!confirm("この発注書を削除しますか？")) return;
    await sb(`purchase_orders?id=eq.${id}`, { method: "DELETE" });
    reloadPos();
    showToast("🗑️ 削除しました");
  };

  const nav = [
    { id: "new", label: "発注書作成", icon: "✏️" },
    { id: "preview", label: "プレビュー / PDF", icon: "🖨️" },
    { id: "history", label: "保存済み発注書", icon: "📚" },
    { id: "suppliers", label: "発注先管理", icon: "🏢" },
    { id: "products", label: "商品登録", icon: "📦" },
    { id: "report", label: "期間別レポート", icon: "📊" },
    { id: "org", label: "自社情報設定", icon: "⚙️" },
  ];

  if (authLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a2e" }}>
      <div style={{ color: "#fff", fontSize: 18 }}>📦 読み込み中...</div>
    </div>
  );

  if (!authToken) return (<><style>{css}</style><LoginPage onLogin={(t, u) => { setAuthToken(t); setAuthUser(u); }} /></>);

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <aside className="sidebar no-print">
          <div className="sidebar-title">📦 PO Manager</div>
          {nav.map((n) => (
            <div key={n.id} className={"nav-item" + (page === n.id ? " active" : "")} onClick={() => setPage(n.id)}>{n.icon} {n.label}</div>
          ))}
          <div style={{ marginTop: "auto", padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            {authUser && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{authUser.email}</div>}
            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={async () => { if (authToken) await signOut(authToken); localStorage.removeItem("po_token"); localStorage.removeItem("po_refresh_token"); currentRefreshToken = ""; setAuthToken(null); setAuthUser(null); }}>🚪 ログアウト</button>
          </div>
        </aside>
        <main className="main">
          <h1 className="no-print">{nav.find((n) => n.id === page)?.label}</h1>
          {page === "new" && (
            <NewPOPage po={po} setPo={setPo} suppliers={suppliers} products={products} org={org} onSave={savePO} saving={saving} />
          )}
          {page === "preview" && <POPrintView po={po} org={org} />}
          {page === "history" && <HistoryPage pos={pos} suppliers={suppliers} onLoad={loadPO} onDelete={deletePO} />}
          {page === "suppliers" && <SuppliersPage suppliers={suppliers} reload={reloadSuppliers} showToast={showToast} />}
          {page === "products" && <ProductsPage products={products} suppliers={suppliers} reload={reloadProducts} showToast={showToast} />}
          {page === "report" && <ReportPage pos={pos} suppliers={suppliers} />}
          {page === "org" && <OrgPage org={org} setOrg={setOrg} save={saveOrg} />}
        </main>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
