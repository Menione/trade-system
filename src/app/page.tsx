"use client";
import { useState, useMemo, useEffect, useCallback } from "react";

// ============================================================
// SUPABASE CLIENT
// ============================================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function supabaseRequest(path: string, options: any = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Prefer": options.method === "POST" ? "return=representation" : "",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ============================================================
// CONSTANTS
// ============================================================
const CURRENCIES = ["JPY","USD","EUR","GBP","SGD","HKD","AUD","CNY"];
const INCOTERMS = ["EXW","FCA","CPT","CIP","DAP","DPU","DDP","FAS","FOB","CFR","CIF"];
const SHIPPING_METHODS = ["Sea Freight","Air Freight","Express (DHL)","Express (FedEx)","Express (UPS)","Land Transport","Rail"];
const COUNTRIES = [
  "Japan","United States","China","Germany","France","United Kingdom","South Korea",
  "Taiwan","Singapore","Hong Kong","Australia","Canada","Thailand","Vietnam","India",
  "Indonesia","Malaysia","Philippines","Bangladesh","Brazil","Mexico","Netherlands",
  "Belgium","Italy","Spain","Sweden","Switzerland","Poland","Turkey","Saudi Arabia"
];
const SAMPLE_HS_CODES = [
  {code:"8471.30",desc:"Portable ADP machines (laptops/tablets)"},
  {code:"8517.12",desc:"Telephones for cellular networks (smartphones)"},
  {code:"8528.72",desc:"LCD monitors / displays"},
  {code:"8536.69",desc:"Electrical connectors / plugs"},
  {code:"8544.42",desc:"Electric conductors / cables"},
  {code:"9403.10",desc:"Metal furniture for offices"},
  {code:"3004.90",desc:"Medicaments (mixed, retail)"},
  {code:"2106.90",desc:"Food preparations NEC"},
  {code:"2309.90",desc:"Animal feeding preparations"},
];
const STEPS = [
  {id:1,label:"Invoice入力",icon:"📋"},
  {id:2,label:"Packing List",icon:"📦"},
  {id:3,label:"内容確認",icon:"✅"},
  {id:4,label:"PDF生成",icon:"📄"},
  {id:5,label:"メール送付",icon:"📧"},
  {id:6,label:"出荷完了",icon:"🚢"},
];

function formatAmount(amount: number, currency: string): string {
  const noDecimal = ["JPY","KRW","TWD","VND","IDR"];
  if (noDecimal.includes(currency)) return Math.round(amount).toLocaleString("ja-JP");
  return amount.toLocaleString("en", {minimumFractionDigits:2, maximumFractionDigits:2});
}

function runValidation(invoice: any, packingItems: any[]) {
  const errors: any[] = [];
  const warnings: any[] = [];
  const items = invoice.items || [];
  if (items.length === 0) {
    errors.push({field:"hsCode",msg:"品目が未登録です。品目を追加してHSコードを入力してください。",risk:"HIGH"});
  } else if (!items.every((i: any) => i.hsCode && i.hsCode.trim() !== "")) {
    errors.push({field:"hsCode",msg:"HSコードが未入力の品目があります。通関に必須です。",risk:"HIGH"});
  }
  if (!invoice.incoterms) errors.push({field:"incoterms",msg:"Incotermsが未選択です。",risk:"HIGH"});
  if (!invoice.countryOfOrigin) errors.push({field:"countryOfOrigin",msg:"原産国が未入力です。",risk:"HIGH"});
  if (!invoice.currency) errors.push({field:"currency",msg:"通貨が未選択です。",risk:"HIGH"});
  packingItems.forEach((carton, idx) => {
    if (!carton.grossWeight || Number(carton.grossWeight) === 0) {
      errors.push({field:`grossWeight_${idx}`,msg:`カートン${carton.cartonNo}の総重量が未入力です。`,risk:"HIGH"});
    }
  });
  if (!invoice.shipper) warnings.push({field:"shipper",msg:"Shipper情報が未入力です。",risk:"LOW"});
  if (!invoice.consignee) warnings.push({field:"consignee",msg:"Consignee情報が未入力です。",risk:"LOW"});
  return {errors, warnings, riskLevel: errors.some((e: any) => e.risk==="HIGH")?"HIGH":errors.length>0?"MEDIUM":warnings.length>0?"LOW":"CLEAR"};
}

// ============================================================
// CSS
// ============================================================
const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#F7F7F5;color:#1A1A1A;min-height:100vh}
:root{
  --surface:#FFFFFF;--border:#E5E3DE;--border-strong:#C8C5BE;
  --text:#1A1A1A;--text-muted:#6B6960;--text-light:#9B9890;
  --blue:#2563EB;--blue-light:#EFF6FF;--blue-mid:#BFDBFE;
  --green:#16A34A;--green-light:#F0FDF4;--green-mid:#BBF7D0;
  --red:#DC2626;--red-light:#FEF2F2;--red-mid:#FECACA;
  --amber:#D97706;--amber-light:#FFFBEB;--amber-mid:#FDE68A;
  --purple:#7C3AED;--purple-light:#F5F3FF;
  --radius:8px;--radius-lg:12px;--radius-xl:16px;
  --shadow:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);
  --shadow-md:0 4px 6px rgba(0,0,0,.07),0 2px 4px rgba(0,0,0,.05);
}
.app{display:flex;min-height:100vh}
.sidebar{width:240px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;height:100vh;overflow-y:auto;z-index:10}
.main{margin-left:240px;flex:1;min-height:100vh}
.sidebar-logo{padding:20px 20px 16px;border-bottom:1px solid var(--border)}
.logo-text{font-size:15px;font-weight:600;color:var(--text)}
.logo-sub{font-size:11px;color:var(--text-muted);margin-top:2px}
.sidebar-nav{padding:12px 8px;flex:1}
.nav-label{font-size:10px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.8px;padding:8px 10px 4px}
.nav-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:var(--radius);cursor:pointer;font-size:13.5px;color:var(--text-muted);transition:all .15s;margin-bottom:1px;border:none;background:none;width:100%;text-align:left}
.nav-item:hover{background:#F0EEE9;color:var(--text)}
.nav-item.active{background:var(--blue-light);color:var(--blue);font-weight:500}
.nav-icon{font-size:14px;width:18px;text-align:center}
.topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:0 28px;height:56px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:5}
.topbar-title{font-size:16px;font-weight:600}
.topbar-actions{display:flex;gap:8px;align-items:center}
.content{padding:28px}
.step-bar{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xl);padding:16px 20px;margin-bottom:24px;display:flex;align-items:center}
.step-item{display:flex;align-items:center;flex:1}
.step-dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;cursor:pointer}
.step-dot.done{background:var(--green);color:#fff}
.step-dot.active{background:var(--blue);color:#fff;box-shadow:0 0 0 3px var(--blue-mid)}
.step-dot.pending{background:#F0EEE9;color:var(--text-muted)}
.step-label{font-size:11px;color:var(--text-muted);margin-top:4px;text-align:center}
.step-line{flex:1;height:2px;background:var(--border);margin:0 4px;margin-bottom:16px}
.step-line.done{background:var(--green)}
.step-content{display:flex;flex-direction:column;align-items:center;min-width:60px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xl);padding:20px 24px;margin-bottom:16px;box-shadow:var(--shadow)}
.card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.card-title{font-size:14px;font-weight:600}
.card-subtitle{font-size:12px;color:var(--text-muted);margin-top:2px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.field{display:flex;flex-direction:column;gap:5px}
.label{font-size:12px;font-weight:500;color:var(--text-muted);display:flex;align-items:center;gap:4px}
.req{color:var(--red);font-size:14px;line-height:1}
.input,select,textarea{font-family:'DM Sans',sans-serif;font-size:13.5px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:8px 11px;transition:all .15s;outline:none;width:100%}
.input:focus,select:focus,textarea:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-light)}
.input.error{border-color:var(--red);background:var(--red-light)}
textarea{resize:vertical;min-height:70px}
.autocomplete-wrap{position:relative}
.autocomplete-list{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--radius-lg);box-shadow:var(--shadow-md);z-index:100;max-height:200px;overflow-y:auto}
.autocomplete-item{padding:8px 12px;font-size:13px;cursor:pointer;display:flex;align-items:flex-start;gap:8px}
.autocomplete-item:hover{background:var(--blue-light)}
.ac-code{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--blue);font-weight:500;min-width:72px;flex-shrink:0}
.ac-desc{font-size:12px;color:var(--text-muted)}
.btn{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;padding:8px 16px;border-radius:var(--radius);border:1px solid transparent;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px}
.btn-primary{background:var(--blue);color:#fff}
.btn-primary:hover{background:#1D4ED8}
.btn-secondary{background:var(--surface);color:var(--text);border-color:var(--border-strong)}
.btn-secondary:hover{background:#F0EEE9}
.btn-danger{background:var(--red-light);color:var(--red);border-color:var(--red-mid)}
.btn-green{background:var(--green);color:#fff}
.btn-green:hover{background:#15803D}
.btn-amber{background:var(--amber);color:#fff}
.btn-sm{padding:5px 11px;font-size:12px}
.btn-xs{padding:3px 8px;font-size:11px}
.validation-panel{border-radius:var(--radius-xl);padding:16px 20px;margin-bottom:16px}
.validation-panel.HIGH{background:#FFF5F5;border:1px solid var(--red-mid)}
.validation-panel.MEDIUM{background:var(--amber-light);border:1px solid var(--amber-mid)}
.validation-panel.LOW{background:#FEFCE8;border:1px solid #FEF08A}
.validation-panel.CLEAR{background:var(--green-light);border:1px solid var(--green-mid)}
.v-title{font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;margin-bottom:10px}
.v-item{font-size:12.5px;padding:5px 0;display:flex;align-items:flex-start;gap:6px;border-top:1px solid rgba(0,0,0,.06)}
.risk-badge{font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;flex-shrink:0}
.risk-badge.HIGH{background:var(--red-mid);color:var(--red)}
.risk-badge.MEDIUM{background:var(--amber-mid);color:var(--amber)}
.risk-badge.LOW{background:#D9F99D;color:#3F6212}
.items-table{width:100%;border-collapse:collapse}
.items-table th{font-size:11px;font-weight:600;color:var(--text-muted);text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);background:#FAFAF8}
.items-table td{padding:5px 6px;border-bottom:1px solid var(--border);vertical-align:middle}
.items-table .input{border:1px solid transparent;background:transparent;padding:5px 8px}
.items-table .input:hover{border-color:var(--border);background:var(--surface)}
.items-table .input:focus{border-color:var(--blue);background:var(--surface)}
.total-row{display:flex;justify-content:flex-end;margin-top:12px;gap:24px;padding:12px 16px;background:#F7F7F5;border-radius:var(--radius-lg)}
.total-label{font-size:12px;color:var(--text-muted)}
.total-value{font-size:18px;font-weight:600}
.history-item{padding:14px 16px;border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:8px;cursor:pointer;transition:all .15s}
.history-item:hover{border-color:var(--blue-mid);background:var(--blue-light)}
.history-meta{display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap}
.tag{font-size:11px;padding:2px 8px;border-radius:4px;font-weight:500}
.tag-blue{background:var(--blue-light);color:var(--blue)}
.tag-green{background:var(--green-light);color:var(--green)}
.tag-amber{background:var(--amber-light);color:var(--amber)}
.tag-gray{background:#F0EEE9;color:var(--text-muted)}
.tag-purple{background:var(--purple-light);color:var(--purple)}
.tag-red{background:var(--red-light);color:var(--red)}
.status-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px}
.status-completed{background:var(--green-mid);color:#14532D}
.status-shipped{background:var(--blue-mid);color:#1E3A8A}
.status-in_progress{background:var(--amber-mid);color:#78350F}
.status-draft{background:#F0EEE9;color:var(--text-muted)}
.tabs{display:flex;gap:2px;background:#F0EEE9;padding:3px;border-radius:var(--radius-lg);margin-bottom:20px}
.tab{padding:7px 16px;border-radius:var(--radius);font-size:13px;font-weight:500;cursor:pointer;color:var(--text-muted);border:none;background:none}
.tab.active{background:var(--surface);color:var(--text);box-shadow:var(--shadow)}
.checklist-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px}
.check-icon{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}
.check-ok{background:var(--green-mid);color:var(--green)}
.check-fail{background:var(--red-mid);color:var(--red)}
.pdf-preview{background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:32px;font-size:12px;line-height:1.6;color:#000}
.pdf-preview h1{font-size:22px;font-weight:700;letter-spacing:2px;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:16px}
.pdf-preview .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
.pdf-preview .meta-item{padding:6px 0;border-bottom:1px solid #EEE}
.pdf-preview .meta-key{font-size:9px;font-weight:600;text-transform:uppercase;color:#666;margin-bottom:2px}
.pdf-preview table{width:100%;border-collapse:collapse;margin-top:16px}
.pdf-preview th{background:#F5F5F5;padding:6px 8px;text-align:left;font-size:10px;font-weight:600;border:1px solid #DDD}
.pdf-preview td{padding:6px 8px;border:1px solid #DDD;font-size:11px}
.pdf-preview .total-section{margin-top:16px;text-align:right;border-top:2px solid #000;padding-top:12px}
.carton-block{border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:12px;overflow:hidden}
.carton-header{background:#FAFAF8;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:8px}
.carton-lines{padding:8px 14px 12px}
.empty-state{text-align:center;padding:48px 24px;color:var(--text-muted)}
.empty-icon{font-size:40px;margin-bottom:12px}
.spinner{display:inline-block;width:16px;height:16px;border:2px solid var(--blue-mid);border-top-color:var(--blue);border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.fade-in{animation:fadeIn .2s ease}
.toast{position:fixed;bottom:24px;right:24px;background:#1A1A1A;color:#fff;padding:12px 20px;border-radius:var(--radius-lg);font-size:13px;z-index:9999;box-shadow:var(--shadow-md)}
`;

// ============================================================
// COMPONENTS
// ============================================================
function Toast({msg, onClose}: any) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return <div className="toast">{msg}</div>;
}

function AutocompleteInput({value, onChange, suggestions, placeholder, className=""}: any) {
  const [open, setOpen] = useState(false);
  const filtered = suggestions?.filter((s: any) =>
    (s.code||s).toLowerCase().includes(value?.toLowerCase()||"") ||
    (s.desc||"").toLowerCase().includes(value?.toLowerCase()||"")
  ).slice(0,8);
  return (
    <div className="autocomplete-wrap">
      <input className={`input ${className}`} value={value||""} placeholder={placeholder}
        onChange={(e: any) => {onChange(e.target.value);setOpen(true)}}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(()=>setOpen(false),150)}
      />
      {open && filtered?.length>0 && (
        <div className="autocomplete-list">
          {filtered.map((s: any, i: number) => (
            <div key={i} className="autocomplete-item" onMouseDown={() => {onChange(s.code||s);setOpen(false)}}>
              {s.code ? <><span className="ac-code">{s.code}</span><span className="ac-desc">{s.desc}</span></> : <span>{s}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ValidationPanel({invoice, packingItems}: any) {
  const {errors, warnings, riskLevel} = useMemo(() => runValidation(invoice, packingItems), [invoice, packingItems]);
  const icon = riskLevel==="HIGH"?"🚨":riskLevel==="MEDIUM"?"⚠️":riskLevel==="LOW"?"💛":"✅";
  const titleText = riskLevel==="HIGH"?"通関リスク: 重大なエラーがあります":riskLevel==="MEDIUM"?"確認が必要な項目があります":riskLevel==="LOW"?"軽微な警告があります":"すべての必須項目が入力されています";
  return (
    <div className={`validation-panel ${riskLevel}`}>
      <div className="v-title">
        <span>{icon}</span><span>{titleText}</span>
        {riskLevel!=="CLEAR"&&<span className={`risk-badge ${riskLevel}`}>{errors.length}エラー / {warnings.length}警告</span>}
      </div>
      {errors.map((e: any, i: number) => <div key={i} className="v-item"><span className={`risk-badge ${e.risk}`}>{e.risk}</span><span style={{color:"var(--red)"}}>🔴 {e.msg}</span></div>)}
      {warnings.map((w: any, i: number) => <div key={i} className="v-item"><span className={`risk-badge ${w.risk}`}>{w.risk}</span><span style={{color:"#65A30D"}}>🟡 {w.msg}</span></div>)}
    </div>
  );
}

function StepBar({currentStep, setStep}: any) {
  return (
    <div className="step-bar">
      {STEPS.map((s, i) => (
        <div key={s.id} className="step-item">
          <div className="step-content">
            <div className={`step-dot ${currentStep>s.id?"done":currentStep===s.id?"active":"pending"}`} onClick={() => setStep(s.id)}>
              {currentStep>s.id?"✓":s.icon}
            </div>
            <div className="step-label">{s.label}</div>
          </div>
          {i<STEPS.length-1 && <div className={`step-line ${currentStep>s.id?"done":""}`}/>}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// INVOICE FORM
// ============================================================
function InvoiceForm({invoice, setInvoice, onNext, customers}: any) {
  const addItem = () => setInvoice((v: any) => ({...v, items:[...(v.items||[]),{id:Date.now(),productName:"",quantity:"",unitPrice:"",currency:v.currency||"JPY",hsCode:""}]}));
  const updateItem = (id: number, field: string, val: any) => setInvoice((v: any) => ({...v,items:v.items.map((it: any) => it.id===id?{...it,[field]:val}:it)}));
  const removeItem = (id: number) => setInvoice((v: any) => ({...v,items:v.items.filter((it: any) => it.id!==id)}));
  const total = (invoice.items||[]).reduce((s: number, it: any) => s+(Number(it.quantity||0)*Number(it.unitPrice||0)), 0);
  const currency = invoice.currency || "JPY";

  const applyCustomer = (c: any) => {
    setInvoice((v: any) => ({
      ...v,
      consignee: [c.name, c.address, c.country].filter(Boolean).join("\n"),
      shipTo: c.consignee_name
        ? [c.consignee_name, c.consignee_address].filter(Boolean).join("\n")
        : "",
      currency: c.currency || v.currency,
      incoterms: c.incoterms || v.incoterms,
      selectedCustomerId: c.id,
    }));
  };

  return (
    <div className="fade-in">
      {/* 書類タイプ */}
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">📋 書類タイプ</div></div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {[{v:"commercial",label:"Commercial Invoice"},{v:"proforma",label:"Proforma Invoice"}].map(t => (
            <button key={t.v} className={`btn ${invoice.invoiceType===t.v?"btn-primary":"btn-secondary"}`}
              onClick={() => setInvoice((v: any) => ({...v,invoiceType:t.v}))}>
              {t.label}
            </button>
          ))}
        </div>
        {invoice.invoiceType==="proforma" && (
          <div style={{marginTop:12,padding:"10px 14px",background:"var(--amber-light)",borderRadius:"var(--radius)",fontSize:13,color:"var(--amber)"}}>
            ⚠️ Proforma Invoice は見積書類です。通関には Commercial Invoice が必要です。
          </div>
        )}
      </div>

      {/* 基本情報 */}
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">📋 基本情報</div><div className="card-subtitle">Invoice No・出荷者・得意先を入力</div></div>
        </div>
        <div className="grid-3" style={{marginBottom:16}}>
          <div className="field">
            <label className="label"><span className="req">*</span>Invoice No</label>
            <input className="input" value={invoice.invoiceNo||""} placeholder="INV-2024-001"
              onChange={(e: any) => setInvoice((v: any) => ({...v,invoiceNo:e.target.value}))} />
          </div>
          <div className="field">
            <label className="label"><span className="req">*</span>作成日付</label>
            <input type="date" className="input" value={invoice.date||""}
              onChange={(e: any) => setInvoice((v: any) => ({...v,date:e.target.value}))} />
          </div>
          <div className="field">
            <label className="label"><span className="req">*</span>Currency</label>
            <select className="input" value={invoice.currency||""}
              onChange={(e: any) => setInvoice((v: any) => ({...v,currency:e.target.value}))}>
              <option value="">選択してください</option>
              {CURRENCIES.map((c: string) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2" style={{marginBottom:16}}>
          <div className="field">
            <label className="label">注文書番号</label>
            <input className="input" value={invoice.poNumber||""} placeholder="PO-2024-001"
              onChange={(e: any) => setInvoice((v: any) => ({...v,poNumber:e.target.value}))} />
          </div>
          <div className="field">
            <label className="label">支払期限</label>
            <input type="date" className="input" value={invoice.paymentDue||""}
              onChange={(e: any) => setInvoice((v: any) => ({...v,paymentDue:e.target.value}))} />
          </div>
        </div>
        <div className="field" style={{marginBottom:16}}>
          <label className="label"><span className="req">*</span>Shipper（出荷者）</label>
          <textarea className="input" value={invoice.shipper||""} rows={3} placeholder={"会社名\n住所\n国"}
            onChange={(e: any) => setInvoice((v: any) => ({...v,shipper:e.target.value}))} />
        </div>

        {/* 得意先選択 */}
        <div style={{marginBottom:12,padding:"12px 16px",background:"var(--blue-light)",borderRadius:"var(--radius-lg)"}}>
          <div style={{fontSize:12,fontWeight:600,color:"var(--blue)",marginBottom:8}}>得意先から引用</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {customers.length === 0 ? (
              <span style={{fontSize:12,color:"var(--text-muted)"}}>得意先が登録されていません。得意先マスタから登録してください。</span>
            ) : customers.map((c: any) => (
              <button key={c.id} className="btn btn-secondary btn-sm" onClick={() => applyCustomer(c)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2" style={{marginBottom:16}}>
          <div className="field">
            <label className="label"><span className="req">*</span>得意先（Consignee）</label>
            <textarea className="input" value={invoice.consignee||""} rows={3} placeholder={"会社名\n住所\n国"}
              onChange={(e: any) => setInvoice((v: any) => ({...v,consignee:e.target.value}))} />
          </div>
          <div className="field">
            <label className="label">荷受先（得意先と異なる場合）</label>
            <textarea className="input" value={invoice.shipTo||""} rows={3} placeholder={"空欄の場合は得意先と同じ\n会社名\n住所\n国"}
              onChange={(e: any) => setInvoice((v: any) => ({...v,shipTo:e.target.value}))} />
          </div>
        </div>
        <div className="field">
          <label className="label">Notify Party</label>
          <textarea className="input" value={invoice.notifyParty||""} rows={2} placeholder="通知先（L/C発行時など）"
            onChange={(e: any) => setInvoice((v: any) => ({...v,notifyParty:e.target.value}))} />
        </div>
      </div>

      {/* 貿易条件 */}
      <div className="card">
        <div className="card-header"><div className="card-title">🚢 貿易条件</div></div>
        <div className="grid-4">
          <div className="field">
            <label className="label"><span className="req">*</span>Incoterms</label>
            <select className="input" value={invoice.incoterms||""}
              onChange={(e: any) => setInvoice((v: any) => ({...v,incoterms:e.target.value}))}>
              <option value="">選択</option>
              {INCOTERMS.map((t: string) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Shipping Method</label>
            <select className="input" value={invoice.shippingMethod||""}
              onChange={(e: any) => setInvoice((v: any) => ({...v,shippingMethod:e.target.value}))}>
              <option value="">選択</option>
              {SHIPPING_METHODS.map((m: string) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label"><span className="req">*</span>Country of Origin</label>
            <AutocompleteInput value={invoice.countryOfOrigin||""} suggestions={COUNTRIES} placeholder="Japan"
              onChange={(v: string) => setInvoice((iv: any) => ({...iv,countryOfOrigin:v}))} />
          </div>
          <div className="field">
            <label className="label">Port of Loading</label>
            <input className="input" value={invoice.portOfLoading||""} placeholder="JPTYO"
              onChange={(e: any) => setInvoice((v: any) => ({...v,portOfLoading:e.target.value}))} />
          </div>
        </div>
      </div>

      {/* 品目明細 */}
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">📦 品目明細</div><div className="card-subtitle">HSコードは必ず入力してください（通関必須）</div></div>
          <button className="btn btn-primary btn-sm" onClick={addItem}>+ 品目追加</button>
        </div>
        {(!invoice.items||invoice.items.length===0) ? (
          <div className="empty-state"><div className="empty-icon">📦</div><div style={{fontSize:14}}>品目を追加してください</div></div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table className="items-table">
              <thead>
                <tr>
                  <th style={{width:180}}>製品名 <span style={{color:"var(--red)"}}>*</span></th>
                  <th style={{width:80}}>数量 <span style={{color:"var(--red)"}}>*</span></th>
                  <th style={{width:100}}>単価</th>
                  <th style={{width:75}}>通貨</th>
                  <th style={{width:130}}>HSコード <span style={{color:"var(--red)"}}>*</span></th>
                  <th style={{width:100,textAlign:"right"}}>小計</th>
                  <th style={{width:36}}></th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item: any) => {
                  const itemCurrency = item.currency || currency;
                  const subtotal = Number(item.quantity||0)*Number(item.unitPrice||0);
                  return (
                    <tr key={item.id}>
                      <td><input className="input" value={item.productName||""} placeholder="製品名" onChange={(e: any) => updateItem(item.id,"productName",e.target.value)}/></td>
                      <td><input className="input" type="number" value={item.quantity||""} placeholder="0" onChange={(e: any) => updateItem(item.id,"quantity",e.target.value)}/></td>
                      <td><input className="input" type="number" value={item.unitPrice||""} placeholder="0" onChange={(e: any) => updateItem(item.id,"unitPrice",e.target.value)}/></td>
                      <td>
                        <select className="input" value={item.currency||currency} onChange={(e: any) => updateItem(item.id,"currency",e.target.value)}>
                          {CURRENCIES.map((c: string) => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td>
                        <AutocompleteInput value={item.hsCode||""} suggestions={SAMPLE_HS_CODES}
                          className={!item.hsCode?"error":""} placeholder="0000.00"
                          onChange={(v: string) => updateItem(item.id,"hsCode",v)} />
                      </td>
                      <td style={{fontWeight:500,fontSize:13,textAlign:"right",paddingRight:8}}>
                        {formatAmount(subtotal, itemCurrency)}
                      </td>
                      <td><button className="btn btn-danger btn-xs" onClick={() => removeItem(item.id)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {(invoice.items?.length>0) && (
          <div className="total-row">
            <div>
              <div className="total-label">Total Amount</div>
              <div className="total-value">{currency} {formatAmount(total, currency)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">📝 備考</div></div>
        <div className="field">
          <textarea className="input" value={invoice.remarks||""} rows={3} placeholder="特記事項・通関上の注意事項など"
            onChange={(e: any) => setInvoice((v: any) => ({...v,remarks:e.target.value}))} />
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <button className="btn btn-primary" onClick={onNext}>Packing List入力へ →</button>
      </div>
    </div>
  );
}

// ============================================================
// PACKING LIST FORM
// ============================================================
function PackingListForm({invoice, packingItems, setPackingItems, onNext, onBack}: any) {
  const invoiceProductNames = (invoice.items||[]).map((i: any) => i.productName).filter(Boolean);

  const addCarton = () => {
    const nextNo = (packingItems.length>0 ? Math.max(...packingItems.map((p: any) => Number(p.cartonNo)||0)) : 0) + 1;
    setPackingItems((v: any[]) => [...v, {id:Date.now(),cartonNo:nextNo,grossWeight:"",netWeight:"",dimensions:"",lines:[{id:Date.now()+1,productName:invoiceProductNames[0]||"",quantity:""}]}]);
  };
  const updateCarton = (cartonId: number, field: string, val: any) => setPackingItems((v: any[]) => v.map((c: any) => c.id===cartonId?{...c,[field]:val}:c));
  const removeCarton = (cartonId: number) => setPackingItems((v: any[]) => v.filter((c: any) => c.id!==cartonId));
  const addLine = (cartonId: number) => setPackingItems((v: any[]) => v.map((c: any) => c.id===cartonId?{...c,lines:[...c.lines,{id:Date.now(),productName:"",quantity:""}]}:c));
  const updateLine = (cartonId: number, lineId: number, field: string, val: any) => setPackingItems((v: any[]) => v.map((c: any) => c.id===cartonId?{...c,lines:c.lines.map((l: any) => l.id===lineId?{...l,[field]:val}:l)}:c));
  const removeLine = (cartonId: number, lineId: number) => setPackingItems((v: any[]) => v.map((c: any) => c.id===cartonId?{...c,lines:c.lines.filter((l: any) => l.id!==lineId)}:c));

  const totalGross = packingItems.reduce((s: number, c: any) => s+Number(c.grossWeight||0), 0);
  const totalNet = packingItems.reduce((s: number, c: any) => s+Number(c.netWeight||0), 0);
  const totalQtyAll = packingItems.reduce((s: number, c: any) => s+(c.lines||[]).reduce((ss: number, l: any) => ss+Number(l.quantity||0), 0), 0);

  const qtyWarnings: string[] = [];
  (invoice.items||[]).forEach((invItem: any) => {
    const packingQty = packingItems.reduce((s: number, carton: any) => {
      return s + (carton.lines||[]).filter((l: any) => l.productName===invItem.productName).reduce((ss: number, l: any) => ss+Number(l.quantity||0), 0);
    }, 0);
    const invQty = Number(invItem.quantity)||0;
    if (invQty>0 && packingQty>0 && invQty!==packingQty) {
      qtyWarnings.push(`「${invItem.productName}」: Invoice ${invQty}個 / Packing ${packingQty}個`);
    }
  });

  return (
    <div className="fade-in">
      {qtyWarnings.length>0 && (
        <div className="validation-panel HIGH" style={{marginBottom:16}}>
          <div className="v-title"><span>🚨</span><span>数量不一致エラー</span></div>
          {qtyWarnings.map((w, i) => <div key={i} className="v-item"><span className="risk-badge HIGH">HIGH</span><span style={{color:"var(--red)"}}>{w}</span></div>)}
        </div>
      )}
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">📦 梱包明細</div><div className="card-subtitle">各カートンに複数製品を混載できます</div></div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              if (!invoice.items?.length) return;
              const auto = invoice.items.map((it: any, i: number) => ({id:Date.now()+i,cartonNo:i+1,grossWeight:"",netWeight:"",dimensions:"",lines:[{id:Date.now()+i+100,productName:it.productName,quantity:it.quantity}]}));
              setPackingItems(auto);
            }}>Invoice から自動反映</button>
            <button className="btn btn-primary btn-sm" onClick={addCarton}>+ カートン追加</button>
          </div>
        </div>

        {packingItems.length===0 ? (
          <div className="empty-state"><div className="empty-icon">📦</div><div style={{fontSize:14}}>「Invoice から自動反映」または「カートン追加」で開始</div></div>
        ) : packingItems.map((carton: any) => (
          <div key={carton.id} className="carton-block">
            <div className="carton-header">
              <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:12,fontWeight:600,color:"var(--text-muted)"}}>Carton No</span>
                  <input className="input" type="number" value={carton.cartonNo} style={{width:60,padding:"4px 8px",fontSize:13}} onChange={(e: any) => updateCarton(carton.id,"cartonNo",e.target.value)}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:12,fontWeight:600,color:"var(--text-muted)"}}>総重量(kg)<span style={{color:"var(--red)"}}>*</span></span>
                  <input className={`input ${!carton.grossWeight?"error":""}`} type="number" value={carton.grossWeight||""} style={{width:80,padding:"4px 8px",fontSize:13}} placeholder="0.00" onChange={(e: any) => updateCarton(carton.id,"grossWeight",e.target.value)}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:12,fontWeight:600,color:"var(--text-muted)"}}>正味重量(kg)</span>
                  <input className="input" type="number" value={carton.netWeight||""} style={{width:80,padding:"4px 8px",fontSize:13}} placeholder="0.00" onChange={(e: any) => updateCarton(carton.id,"netWeight",e.target.value)}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:12,fontWeight:600,color:"var(--text-muted)"}}>寸法(cm)</span>
                  <input className="input" value={carton.dimensions||""} style={{width:110,padding:"4px 8px",fontSize:13}} placeholder="60x40x30" onChange={(e: any) => updateCarton(carton.id,"dimensions",e.target.value)}/>
                </div>
              </div>
              <button className="btn btn-danger btn-xs" onClick={() => removeCarton(carton.id)}>カートン削除</button>
            </div>
            <div className="carton-lines">
              <div style={{display:"grid",gridTemplateColumns:"1fr 80px 36px",gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:600,color:"var(--text-muted)"}}>製品名</span>
                <span style={{fontSize:11,fontWeight:600,color:"var(--text-muted)"}}>数量</span>
                <span></span>
              </div>
              {(carton.lines||[]).map((line: any) => (
                <div key={line.id} style={{display:"grid",gridTemplateColumns:"1fr 80px 36px",gap:8,alignItems:"center",marginBottom:6}}>
                  <select className="input" value={line.productName||""} style={{fontSize:13}} onChange={(e: any) => updateLine(carton.id,line.id,"productName",e.target.value)}>
                    <option value="">製品を選択</option>
                    {invoiceProductNames.map((name: string) => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <input className="input" type="number" value={line.quantity||""} placeholder="0" style={{fontSize:13}} onChange={(e: any) => updateLine(carton.id,line.id,"quantity",e.target.value)}/>
                  <button className="btn btn-danger btn-xs" onClick={() => removeLine(carton.id,line.id)} disabled={(carton.lines||[]).length<=1} style={{opacity:(carton.lines||[]).length<=1?0.3:1}}>✕</button>
                </div>
              ))}
              <button className="btn btn-secondary btn-xs" style={{marginTop:4}} onClick={() => addLine(carton.id)}>+ 品目追加（混載）</button>
              <div style={{marginTop:6,fontSize:12,color:"var(--text-muted)"}}>
                このカートン合計: <strong>{(carton.lines||[]).reduce((s: number,l: any) => s+Number(l.quantity||0),0)} pcs</strong>
              </div>
            </div>
          </div>
        ))}

        {packingItems.length>0 && (
          <div style={{display:"flex",gap:24,marginTop:12,padding:"12px 16px",background:"#F7F7F5",borderRadius:"var(--radius-lg)"}}>
            <div><div className="total-label">総カートン数</div><div className="total-value">{packingItems.length} ctns</div></div>
            <div><div className="total-label">合計数量</div><div className="total-value">{totalQtyAll} pcs</div></div>
            <div><div className="total-label">総重量</div><div className="total-value">{totalGross.toFixed(2)} kg</div></div>
            <div><div className="total-label">正味重量</div><div className="total-value">{totalNet.toFixed(2)} kg</div></div>
          </div>
        )}
      </div>

      <div style={{display:"flex",justifyContent:"space-between"}}>
        <button className="btn btn-secondary" onClick={onBack}>← Invoice に戻る</button>
        <button className="btn btn-primary" onClick={onNext}>内容確認へ →</button>
      </div>
    </div>
  );
}

// ============================================================
// REVIEW PAGE
// ============================================================
function ReviewPage({invoice, packingItems, onNext, onBack}: any) {
  const {errors, riskLevel} = useMemo(() => runValidation(invoice, packingItems), [invoice, packingItems]);
  const total = (invoice.items||[]).reduce((s: number, it: any) => s+(Number(it.quantity||0)*Number(it.unitPrice||0)), 0);
  const currency = invoice.currency || "JPY";
  const totalQtyAll = packingItems.reduce((s: number, c: any) => s+(c.lines||[]).reduce((ss: number, l: any) => ss+Number(l.quantity||0), 0), 0);

  const checks = [
    {label:"Invoice No 入力済み",ok:!!invoice.invoiceNo},
    {label:"Shipper 入力済み",ok:!!invoice.shipper},
    {label:"得意先（Consignee）入力済み",ok:!!invoice.consignee},
    {label:"品目が1件以上ある",ok:(invoice.items?.length||0)>0},
    {label:"全品目にHSコード入力済み",ok:(invoice.items||[]).length>0&&(invoice.items||[]).every((i: any) => i.hsCode&&i.hsCode.trim()!=="")},
    {label:"Incoterms 選択済み",ok:!!invoice.incoterms},
    {label:"原産国 入力済み",ok:!!invoice.countryOfOrigin},
    {label:"Packing List 作成済み",ok:packingItems.length>0},
    {label:"重量入力済み",ok:packingItems.every((c: any) => c.grossWeight&&Number(c.grossWeight)>0)},
  ];
  const score = checks.filter((c: any) => c.ok).length;

  return (
    <div className="fade-in">
      <ValidationPanel invoice={invoice} packingItems={packingItems} />
      <div className="grid-2" style={{marginBottom:16}}>
        <div className="card">
          <div className="card-title" style={{marginBottom:14}}>📋 チェックリスト ({score}/{checks.length})</div>
          {checks.map((c: any, i: number) => (
            <div key={i} className="checklist-item">
              <div className={`check-icon ${c.ok?"check-ok":"check-fail"}`}>{c.ok?"✓":"✕"}</div>
              <span style={{fontSize:13,color:c.ok?"var(--text)":"var(--red)"}}>{c.label}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title" style={{marginBottom:14}}>📊 Invoice サマリー</div>
          <table style={{width:"100%",fontSize:13}}>
            <tbody>
              {[
                ["書類タイプ",invoice.invoiceType==="proforma"?"Proforma Invoice":"Commercial Invoice"],
                ["Invoice No",invoice.invoiceNo||"—"],
                ["作成日付",invoice.date||"—"],
                ["Incoterms",invoice.incoterms||"—"],
                ["Country of Origin",invoice.countryOfOrigin||"—"],
                ["品目数",`${invoice.items?.length||0}件`],
                ["合計金額",`${currency} ${formatAmount(total, currency)}`],
                ["総カートン数",`${packingItems.length} ctns`],
                ["合計数量",`${totalQtyAll} pcs`],
                ["総重量",`${packingItems.reduce((s: number,c: any)=>s+Number(c.grossWeight||0),0).toFixed(2)} kg`],
              ].map(([k,v]: any) => (
                <tr key={k}><td style={{color:"var(--text-muted)",padding:"5px 0",borderBottom:"1px solid var(--border)"}}>{k}</td>
                <td style={{fontWeight:500,textAlign:"right",padding:"5px 0",borderBottom:"1px solid var(--border)"}}>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <button className="btn btn-secondary" onClick={onBack}>← Packing List に戻る</button>
        <button className="btn btn-primary" onClick={onNext} disabled={riskLevel==="HIGH"} style={{opacity:riskLevel==="HIGH"?.5:1}}>
          {riskLevel==="HIGH"?"⚠️ エラー解消後に進んでください":"PDF生成へ →"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// OUTPUT PAGE
// ============================================================
function OutputPage({invoice, packingItems, onBack}: any) {
  const [activeDoc, setActiveDoc] = useState("invoice");
  const total = (invoice.items||[]).reduce((s: number,it: any)=>s+(Number(it.quantity||0)*Number(it.unitPrice||0)),0);
  const currency = invoice.currency || "JPY";
  const isProforma = invoice.invoiceType === "proforma";

  const packingRows: any[] = [];
  packingItems.forEach((carton: any) => {
    (carton.lines||[]).forEach((line: any, li: number) => {
      packingRows.push({
        cartonNo: li===0?carton.cartonNo:"",
        productName: line.productName,
        quantity: line.quantity,
        grossWeight: li===0?Number(carton.grossWeight||0).toFixed(2):"",
        netWeight: li===0?Number(carton.netWeight||0).toFixed(2):"",
        dimensions: li===0?(carton.dimensions||"—"):"",
        isFirst: li===0,
      });
    });
  });

  const handlePrint = () => {
    const content = document.getElementById("print-area");
    const w = window.open("","","width=900,height=1200");
    if (!w||!content) return;
    w.document.write(`<html><head><title>${activeDoc==="invoice"?(isProforma?"Proforma Invoice":"Commercial Invoice"):"Packing List"}</title>
      <style>*{font-family:sans-serif;font-size:11px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px}th{background:#f5f5f5}</style>
      </head><body>${content.innerHTML}</body></html>`);
    w.document.close(); w.print();
  };

  return (
    <div className="fade-in">
      <div className="tabs">
        <button className={`tab ${activeDoc==="invoice"?"active":""}`} onClick={()=>setActiveDoc("invoice")}>📋 {isProforma?"Proforma Invoice":"Commercial Invoice"}</button>
        <button className={`tab ${activeDoc==="packing"?"active":""}`} onClick={()=>setActiveDoc("packing")}>📦 Packing List</button>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">{activeDoc==="invoice"?(isProforma?"Proforma Invoice プレビュー":"Invoice プレビュー"):"Packing List プレビュー"}</div>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}>🖨️ PDF印刷</button>
        </div>
        <div id="print-area" className="pdf-preview">
          {activeDoc==="invoice" ? (
            <>
              <h1>{isProforma?"PROFORMA INVOICE":"COMMERCIAL INVOICE"}</h1>
              <div className="meta-grid">
                <div className="meta-item"><div className="meta-key">Invoice No.</div><strong>{invoice.invoiceNo||"—"}</strong></div>
                <div className="meta-item"><div className="meta-key">Date</div>{invoice.date||"—"}</div>
                <div className="meta-item"><div className="meta-key">Incoterms</div>{invoice.incoterms||"—"}</div>
                <div className="meta-item"><div className="meta-key">Country of Origin</div>{invoice.countryOfOrigin||"—"}</div>
                {invoice.poNumber&&<div className="meta-item"><div className="meta-key">P.O. Number</div>{invoice.poNumber}</div>}
                {invoice.paymentDue&&<div className="meta-item"><div className="meta-key">Payment Due</div>{invoice.paymentDue}</div>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:12}}>
                <div><div className="meta-key" style={{marginBottom:4}}>SHIPPER</div><div style={{whiteSpace:"pre-wrap",fontSize:11}}>{invoice.shipper||"—"}</div></div>
                <div>
                  <div className="meta-key" style={{marginBottom:4}}>CONSIGNEE</div>
                  <div style={{whiteSpace:"pre-wrap",fontSize:11}}>{invoice.consignee||"—"}</div>
                  {invoice.shipTo&&<>
                    <div className="meta-key" style={{marginBottom:4,marginTop:8}}>SHIP TO</div>
                    <div style={{whiteSpace:"pre-wrap",fontSize:11}}>{invoice.shipTo}</div>
                  </>}
                </div>
              </div>
              <table>
                <thead><tr><th>Description of Goods</th><th>HS Code</th><th style={{textAlign:"right"}}>Qty</th><th style={{textAlign:"right"}}>Unit Price</th><th style={{textAlign:"right"}}>Amount</th></tr></thead>
                <tbody>
                  {(invoice.items||[]).map((it: any, i: number) => (
                    <tr key={i}><td>{it.productName}</td><td style={{fontFamily:"monospace"}}>{it.hsCode}</td>
                    <td style={{textAlign:"right"}}>{it.quantity}</td>
                    <td style={{textAlign:"right"}}>{currency} {formatAmount(Number(it.unitPrice||0),currency)}</td>
                    <td style={{textAlign:"right"}}>{currency} {formatAmount(Number(it.quantity||0)*Number(it.unitPrice||0),currency)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="total-section"><strong>TOTAL: {currency} {formatAmount(total,currency)}</strong></div>
              {invoice.remarks&&<div style={{marginTop:16,fontSize:11}}><strong>Remarks:</strong> {invoice.remarks}</div>}
            </>
          ) : (
            <>
              <h1>PACKING LIST</h1>
              <div className="meta-grid">
                <div className="meta-item"><div className="meta-key">Invoice No.</div><strong>{invoice.invoiceNo||"—"}</strong></div>
                <div className="meta-item"><div className="meta-key">Date</div>{invoice.date||"—"}</div>
                <div className="meta-item"><div className="meta-key">Total Cartons</div>{packingItems.length} CTNS</div>
                <div className="meta-item"><div className="meta-key">Total G.W.</div>{packingItems.reduce((s: number,c: any)=>s+Number(c.grossWeight||0),0).toFixed(2)} kg</div>
              </div>
              <table>
                <thead><tr><th>Carton No</th><th>Description</th><th style={{textAlign:"right"}}>Qty</th><th style={{textAlign:"right"}}>G.W.(kg)</th><th style={{textAlign:"right"}}>N.W.(kg)</th><th>Dimensions(cm)</th></tr></thead>
                <tbody>
                  {packingRows.map((row: any, i: number) => (
                    <tr key={i} style={{background:row.isFirst?"#fff":"#FAFAF8"}}>
                      <td>{row.cartonNo}</td><td>{row.productName}</td>
                      <td style={{textAlign:"right"}}>{row.quantity}</td>
                      <td style={{textAlign:"right"}}>{row.grossWeight}</td>
                      <td style={{textAlign:"right"}}>{row.netWeight}</td>
                      <td>{row.dimensions}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>TOTAL</th><th></th>
                    <th style={{textAlign:"right"}}>{packingRows.reduce((s: number,r: any)=>s+(Number(r.quantity)||0),0)}</th>
                    <th style={{textAlign:"right"}}>{packingItems.reduce((s: number,c: any)=>s+Number(c.grossWeight||0),0).toFixed(2)}</th>
                    <th style={{textAlign:"right"}}>{packingItems.reduce((s: number,c: any)=>s+Number(c.netWeight||0),0).toFixed(2)}</th>
                    <th></th>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <button className="btn btn-secondary" onClick={onBack}>← 内容確認に戻る</button>
        <button className="btn btn-primary" onClick={() => alert("メール送信機能は今後対応予定です")}>📧 メール送付へ →</button>
      </div>
    </div>
  );
}

// ============================================================
// HISTORY PAGE (Supabase連携)
// ============================================================
function HistoryPage({onLoad}: any) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const statusLabel: any = {completed:"出荷完了",shipped:"輸送中",in_progress:"作業中",draft:"下書き"};

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supabaseRequest("invoices?order=created_at.desc");
      setInvoices(data||[]);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const deleteInvoice = async (id: string, e: any) => {
    e.stopPropagation();
    if (!confirm("削除しますか？")) return;
    await supabaseRequest(`invoices?id=eq.${id}`, {method:"DELETE"});
    fetchInvoices();
  };

  const filtered = invoices.filter(h => {
    const q = search.toLowerCase();
    const matchQ = !q||
      (h.invoice_no||"").toLowerCase().includes(q)||
      (h.consignee||"").toLowerCase().includes(q)||
      (h.country_of_origin||"").toLowerCase().includes(q);
    const matchS = filterStatus==="all"||h.status===filterStatus;
    return matchQ&&matchS;
  });

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <div className="card-title">📚 保存済み案件一覧</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {["all","draft","in_progress","shipped","completed"].map(s => (
              <button key={s} className={`btn btn-sm ${filterStatus===s?"btn-primary":"btn-secondary"}`} onClick={() => setFilterStatus(s)}>
                {s==="all"?"全て":statusLabel[s]||s}
              </button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <input className="input" placeholder="🔍 Invoice No・得意先・国で検索..." value={search} onChange={(e: any) => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <div style={{textAlign:"center",padding:32}}><div className="spinner"></div></div>
        ) : filtered.length===0 ? (
          <div className="empty-state"><div className="empty-icon">📭</div><div style={{fontSize:14}}>保存済みの案件がありません</div></div>
        ) : filtered.map(h => (
          <div key={h.id} className="history-item" onClick={() => onLoad(h)}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
              <strong style={{fontSize:14}}>{h.invoice_no||"No Invoice No"}</strong>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span className={`status-badge status-${h.status||"draft"}`}>● {statusLabel[h.status||"draft"]}</span>
                <button className="btn btn-danger btn-xs" onClick={(e) => deleteInvoice(h.id,e)}>削除</button>
              </div>
            </div>
            <div style={{fontSize:13,color:"var(--text-muted)",marginBottom:6}}>{h.consignee?.split("\n")[0]||"—"}</div>
            <div className="history-meta">
              {h.country_of_origin&&<span className="tag tag-blue">{h.country_of_origin}</span>}
              {h.date&&<span className="tag tag-gray">{h.date}</span>}
              {h.currency&&<span className="tag tag-green">{h.currency}</span>}
              {h.invoice_type==="proforma"&&<span className="tag tag-amber">Proforma</span>}
              <span style={{fontSize:11,color:"var(--text-light)"}}>{new Date(h.created_at).toLocaleDateString("ja-JP")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// CUSTOMER MASTER PAGE (Supabase連携)
// ============================================================
function CustomerMasterPage({onCustomersChange}: any) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({name:"",address:"",consignee_name:"",consignee_address:"",country:"Japan",currency:"JPY",incoterms:"",contact:"",email:""});

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supabaseRequest("customers?order=created_at.desc");
      setCustomers(data||[]);
      onCustomersChange(data||[]);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [onCustomersChange]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const save = async () => {
    if (!form.name.trim()) return alert("会社名を入力してください");
    await supabaseRequest("customers", {method:"POST", body:JSON.stringify(form)});
    setForm({name:"",address:"",consignee_name:"",consignee_address:"",country:"Japan",currency:"JPY",incoterms:"",contact:"",email:""});
    setShowForm(false);
    fetchCustomers();
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await supabaseRequest(`customers?id=eq.${id}`, {method:"DELETE"});
    fetchCustomers();
  };

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">🏢 得意先マスタ</div><div className="card-subtitle">得意先と荷受先を登録。Invoice作成時に自動入力できます。</div></div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>+ 得意先追加</button>
        </div>
        {showForm && (
          <div style={{background:"#F7F7F5",borderRadius:"var(--radius-lg)",padding:16,marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:12}}>得意先情報（Consignee）</div>
            <div className="grid-2" style={{marginBottom:12}}>
              <div className="field"><label className="label"><span className="req">*</span>会社名</label>
                <input className="input" value={form.name} placeholder="ABC Co., Ltd." onChange={(e:any)=>setForm(v=>({...v,name:e.target.value}))}/></div>
              <div className="field"><label className="label">担当者名</label>
                <input className="input" value={form.contact} placeholder="田中 太郎" onChange={(e:any)=>setForm(v=>({...v,contact:e.target.value}))}/></div>
            </div>
            <div className="field" style={{marginBottom:12}}>
              <label className="label">住所</label>
              <textarea className="input" rows={2} value={form.address} placeholder={"1-1-1 Example, Tokyo, Japan"} onChange={(e:any)=>setForm(v=>({...v,address:e.target.value}))}/>
            </div>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:4,marginTop:16}}>🚚 Ship To（納品先・荷受先）</div>
<div style={{fontSize:12,color:"var(--text-muted)",marginBottom:12}}>取引先と実際の届け先が異なる場合に入力してください。Invoice の「SHIP TO」欄に反映されます。</div>
            <div className="field" style={{marginBottom:12}}>
              <label className="label">荷受先会社名</label>
              <input className="input" value={form.consignee_name} placeholder="Warehouse Co., Ltd." onChange={(e:any)=>setForm(v=>({...v,consignee_name:e.target.value}))}/>
            </div>
            <div className="field" style={{marginBottom:12}}>
              <label className="label">荷受先住所</label>
              <textarea className="input" rows={2} value={form.consignee_address} placeholder={"住所\n国"} onChange={(e:any)=>setForm(v=>({...v,consignee_address:e.target.value}))}/>
            </div>
            <div className="grid-4" style={{marginBottom:12}}>
              <div className="field"><label className="label">国</label>
                <AutocompleteInput value={form.country} suggestions={COUNTRIES} placeholder="Japan" onChange={(val:string)=>setForm(v=>({...v,country:val}))}/></div>
              <div className="field"><label className="label">デフォルト通貨</label>
                <select className="input" value={form.currency} onChange={(e:any)=>setForm(v=>({...v,currency:e.target.value}))}>
                  {CURRENCIES.map((c:string)=><option key={c}>{c}</option>)}</select></div>
              <div className="field"><label className="label">Incoterms</label>
                <select className="input" value={form.incoterms} onChange={(e:any)=>setForm(v=>({...v,incoterms:e.target.value}))}>
                  <option value="">選択</option>{INCOTERMS.map((t:string)=><option key={t}>{t}</option>)}</select></div>
              <div className="field"><label className="label">メール</label>
                <input className="input" value={form.email} placeholder="abc@example.com" onChange={(e:any)=>setForm(v=>({...v,email:e.target.value}))}/></div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-primary btn-sm" onClick={save}>保存</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>setShowForm(false)}>キャンセル</button>
            </div>
          </div>
        )}
        {loading ? (
          <div style={{textAlign:"center",padding:32}}><div className="spinner"></div></div>
        ) : customers.length===0 ? (
          <div className="empty-state"><div className="empty-icon">🏢</div><div style={{fontSize:14}}>得意先を登録してください</div></div>
        ) : customers.map((c:any) => (
          <div key={c.id} className="history-item">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <strong style={{fontSize:14}}>{c.name}</strong>
              <button className="btn btn-danger btn-xs" onClick={()=>deleteCustomer(c.id)}>削除</button>
            </div>
            <div className="history-meta" style={{marginTop:6}}>
              <span className="tag tag-blue">{c.country}</span>
              <span className="tag tag-gray">{c.currency}</span>
              {c.incoterms&&<span className="tag tag-green">{c.incoterms}</span>}
              {c.contact&&<span className="tag tag-amber">{c.contact}</span>}
              {c.email&&<span className="tag tag-purple">{c.email}</span>}
            </div>
            {c.address&&<div style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>{c.address}</div>}
            {c.consignee_name&&(
              <div style={{marginTop:8,padding:"6px 10px",background:"var(--blue-light)",borderRadius:"var(--radius)",fontSize:12}}>
                <span style={{color:"var(--blue)",fontWeight:600}}>荷受先: </span>{c.consignee_name}
                {c.consignee_address&&<span style={{color:"var(--text-muted)"}}> / {c.consignee_address}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// PRODUCT MASTER PAGE (Supabase連携)
// ============================================================
function ProductMasterPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({name:"",hs_code:"",unit:"pcs",unit_price:"",currency:"JPY",weight:""});

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supabaseRequest("products?order=created_at.desc");
      setProducts(data||[]);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const save = async () => {
    if (!form.name.trim()) return alert("製品名を入力してください");
    await supabaseRequest("products", {method:"POST", body:JSON.stringify({...form,unit_price:form.unit_price?Number(form.unit_price):null,weight:form.weight?Number(form.weight):null})});
    setForm({name:"",hs_code:"",unit:"pcs",unit_price:"",currency:"JPY",weight:""});
    setShowForm(false);
    fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await supabaseRequest(`products?id=eq.${id}`, {method:"DELETE"});
    fetchProducts();
  };

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">🗂️ 製品マスタ</div><div className="card-subtitle">製品情報を登録してInvoice作成時に自動補完</div></div>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(v=>!v)}>+ 製品追加</button>
        </div>
        {showForm && (
          <div style={{background:"#F7F7F5",borderRadius:"var(--radius-lg)",padding:16,marginBottom:16}}>
            <div className="grid-2" style={{marginBottom:12}}>
              <div className="field"><label className="label"><span className="req">*</span>製品名</label>
                <input className="input" value={form.name} placeholder="Product Name" onChange={(e:any)=>setForm(v=>({...v,name:e.target.value}))}/></div>
              <div className="field"><label clas