"use client";
import { useState, useEffect, useCallback } from "react";

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
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
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

const INITIAL_INVOICE = {
  invoiceType:"commercial", invoiceNo:"", date:"", poNumber:"", paymentDue:"",
  shipper:"", consignee:"", shipTo:"", notifyParty:"",
  currency:"JPY", incoterms:"", countryOfOrigin:"Japan",
  shippingMethod:"", portOfLoading:"", remarks:"", items:[],
};

const INITIAL_ORG = {
  companyName:"", address:"", tel:"", email:"", website:"",
  bankName:"", bankBranch:"", accountType:"", accountNo:"", accountName:"", swiftCode:"",
  signerName:"", signerTitle:"", logoUrl:"",
};

// ============================================================
// HELPERS
// ============================================================
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
    errors.push({field:"hsCode",step:1,msg:"品目が未登録です。品目を追加してHSコードを入力してください。",risk:"HIGH"});
  } else if (!items.every((i: any) => i.hsCode && i.hsCode.trim() !== "")) {
    errors.push({field:"hsCode",step:1,msg:"HSコードが未入力の品目があります。通関に必須です。",risk:"HIGH"});
  }
  if (!invoice.incoterms) errors.push({field:"incoterms",step:1,msg:"Incotermsが未選択です。",risk:"HIGH"});
  if (!invoice.countryOfOrigin) errors.push({field:"countryOfOrigin",step:1,msg:"原産国が未入力です。",risk:"HIGH"});
  if (!invoice.currency) errors.push({field:"currency",step:1,msg:"通貨が未選択です。",risk:"HIGH"});
  packingItems.forEach((carton, idx) => {
    if (!carton.grossWeight || Number(carton.grossWeight) === 0) {
      errors.push({field:`grossWeight_${idx}`,step:2,msg:`カートン${carton.cartonNo}の総重量が未入力です。`,risk:"HIGH"});
    }
  });
  if (!invoice.shipper) warnings.push({field:"shipper",step:1,msg:"Shipper情報が未入力です。",risk:"LOW"});
  if (!invoice.consignee) warnings.push({field:"consignee",step:1,msg:"Consignee情報が未入力です。",risk:"LOW"});
  return {errors, warnings, riskLevel: errors.some((e: any)=>e.risk==="HIGH")?"HIGH":errors.length>0?"MEDIUM":warnings.length>0?"LOW":"CLEAR"};
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
.btn-sm{padding:5px 11px;font-size:12px}
.btn-xs{padding:3px 8px;font-size:11px}
.validation-panel{border-radius:var(--radius-xl);padding:16px 20px;margin-bottom:16px}
.validation-panel.HIGH{background:#FFF5F5;border:1px solid var(--red-mid)}
.validation-panel.MEDIUM{background:var(--amber-light);border:1px solid var(--amber-mid)}
.validation-panel.LOW{background:#FEFCE8;border:1px solid #FEF08A}
.validation-panel.CLEAR{background:var(--green-light);border:1px solid var(--green-mid)}
.v-title{font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;margin-bottom:10px}
.v-item{font-size:12.5px;padding:5px 0;display:flex;align-items:flex-start;gap:6px;border-top:1px solid rgba(0,0,0,.06);cursor:pointer}
.v-item:hover{opacity:.8}
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
.pdf-preview .bank-section{margin-top:20px;padding:12px;border:1px solid #DDD;border-radius:4px;background:#FAFAFA;font-size:10px}
.pdf-preview .sig-section{margin-top:24px;display:flex;justify-content:flex-end}
.pdf-preview .sig-box{text-align:center;border-top:1px solid #000;padding-top:8px;min-width:200px}
.carton-block{border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:12px;overflow:hidden}
.carton-header{background:#FAFAF8;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:8px}
.carton-lines{padding:8px 14px 12px}
.empty-state{text-align:center;padding:48px 24px;color:var(--text-muted)}
.empty-icon{font-size:40px;margin-bottom:12px}
.spinner{display:inline-block;width:16px;height:16px;border:2px solid var(--blue-mid);border-top-color:var(--blue);border-radius:50%;animation:spin .6s linear infinite}
.section-title{font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)}
.ship-to-box{background:var(--blue-light);border:1px solid var(--blue-mid);border-radius:var(--radius-lg);padding:14px;margin-top:8px}
.dim-input-row{display:flex;align-items:center;gap:6px}
.dim-input-row input{width:70px;flex-shrink:0}
.dim-sep{color:var(--text-muted);font-weight:600;font-size:14px}
.org-section{margin-bottom:24px}
.org-section-title{font-size:13px;font-weight:600;color:var(--blue);border-left:3px solid var(--blue);padding-left:10px;margin-bottom:14px}
.saved-banner{background:var(--green-light);border:1px solid var(--green-mid);border-radius:var(--radius-lg);padding:10px 16px;margin-bottom:16px;font-size:13px;color:var(--green);display:flex;align-items:center;gap:8px}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.fade-in{animation:fadeIn .2s ease}
`;

// ============================================================
// SUB COMPONENTS
// ============================================================
function AutocompleteInput({value, onChange, suggestions, placeholder, className=""}: any) {
  const [open, setOpen] = useState(false);
  const filtered = suggestions.filter((s: any) => {
    const v = value?.toLowerCase() || "";
    if (!v) return true;
    if (typeof s === "string") return s.toLowerCase().includes(v);
    return s.code?.toLowerCase().includes(v) || s.desc?.toLowerCase().includes(v);
  }).slice(0, 10);

  return (
    <div className="autocomplete-wrap">
      <input className={`input ${className}`} value={value||""} placeholder={placeholder}
        onChange={(e: any) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && filtered.length > 0 && (
        <div className="autocomplete-list">
          {filtered.map((s: any, i: number) => (
            <div key={i} className="autocomplete-item" onMouseDown={() => { onChange(typeof s === "string" ? s : s.code); setOpen(false); }}>
              {typeof s === "string" ? s : <><span className="ac-code">{s.code}</span><span className="ac-desc">{s.desc}</span></>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ValidationPanel({invoice, packingItems, onJumpStep}: any) {
  const {errors, warnings, riskLevel} = runValidation(invoice, packingItems);
  const all = [...errors, ...warnings];
  const icons: any = {HIGH:"🔴",MEDIUM:"🟡",LOW:"🟢",CLEAR:"✅"};
  const titles: any = {HIGH:"通関リスク HIGH — 必須項目が未入力です",MEDIUM:"注意が必要な項目があります",LOW:"軽微な警告があります",CLEAR:"問題なし — 通関リスクはありません"};
  return (
    <div className={`validation-panel ${riskLevel}`}>
      <div className="v-title">{icons[riskLevel]} {titles[riskLevel]}</div>
      {all.map((e, i) => (
        <div key={i} className="v-item" onClick={() => onJumpStep && onJumpStep(e.step||1)}>
          <span className={`risk-badge ${e.risk}`}>{e.risk}</span>
          <span>{e.msg}</span>
          {onJumpStep && <span style={{marginLeft:"auto",fontSize:11,color:"var(--blue)"}}>→ 修正</span>}
        </div>
      ))}
    </div>
  );
}

function StepBar({currentStep, setStep}: any) {
  return (
    <div className="step-bar">
      {STEPS.map((s, i) => (
        <div key={s.id} className="step-item">
          <div className="step-content">
            <div className={`step-dot ${currentStep>s.id?"done":currentStep===s.id?"active":"pending"}`}
              onClick={() => setStep(s.id)}>
              {currentStep>s.id?"✓":s.icon}
            </div>
            <div className="step-label">{s.label}</div>
          </div>
          {i < STEPS.length-1 && <div className={`step-line ${currentStep>s.id?"done":""}`}/>}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// INVOICE FORM
// ============================================================
function InvoiceForm({invoice, setInvoice, onNext, customers, org}: any) {
  const addItem = () => setInvoice((v: any) => ({...v, items:[...(v.items||[]),{id:Date.now(),productName:"",quantity:"",unitPrice:"",currency:v.currency||"JPY",hsCode:""}]}));
  const updateItem = (id: number, field: string, val: any) => setInvoice((v: any) => ({...v,items:v.items.map((it: any)=>it.id===id?{...it,[field]:val}:it)}));
  const removeItem = (id: number) => setInvoice((v: any) => ({...v,items:v.items.filter((it: any)=>it.id!==id)}));
  const total = (invoice.items||[]).reduce((s: number,it: any)=>s+(Number(it.quantity||0)*Number(it.unitPrice||0)),0);
  const currency = invoice.currency || "JPY";

  const applyCustomer = (c: any) => {
    setInvoice((v: any) => ({
      ...v,
      consignee: [c.name, c.address, c.country].filter(Boolean).join("\n"),
      shipTo: c.consignee_name ? [c.consignee_name, c.consignee_address].filter(Boolean).join("\n") : "",
      currency: c.currency || v.currency,
      incoterms: c.incoterms || v.incoterms,
      selectedCustomerId: c.id,
    }));
  };

  // 組織設定からShipperを自動セット（初回のみ）
  useEffect(() => {
    if (org && org.companyName && !invoice.shipper) {
      setInvoice((v: any) => ({
        ...v,
        shipper: [org.companyName, org.address].filter(Boolean).join("\n"),
      }));
    }
  }, [org]);

  return (
    <div className="fade-in">
      {/* 書類タイプ */}
      <div className="card">
        <div className="card-header"><div className="card-title">📋 書類タイプ</div></div>
        <div style={{display:"flex",gap:8}}>
          {[{v:"commercial",label:"Commercial Invoice"},{v:"proforma",label:"Proforma Invoice"}].map(t => (
            <button key={t.v} className={`btn ${invoice.invoiceType===t.v?"btn-primary":"btn-secondary"}`}
              onClick={() => setInvoice((v: any)=>({...v,invoiceType:t.v}))}>
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
        <div className="card-header"><div className="card-title">📋 基本情報</div></div>
        <div className="grid-3" style={{marginBottom:16}}>
          <div className="field">
            <label className="label"><span className="req">*</span>Invoice No</label>
            <input className="input" value={invoice.invoiceNo||""} placeholder="INV-2024-001"
              onChange={(e:any)=>setInvoice((v:any)=>({...v,invoiceNo:e.target.value}))}/>
          </div>
          <div className="field">
            <label className="label"><span className="req">*</span>作成日付</label>
            <input type="date" className="input" value={invoice.date||""}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,date:e.target.value}))}/>
          </div>
          <div className="field">
            <label className="label"><span className="req">*</span>Currency</label>
            <select className="input" value={invoice.currency||""}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,currency:e.target.value}))}>
              <option value="">選択してください</option>
              {CURRENCIES.map((c:string)=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2" style={{marginBottom:16}}>
          <div className="field">
            <label className="label">注文書番号（P.O. Number）</label>
            <input className="input" value={invoice.poNumber||""} placeholder="PO-2024-001"
              onChange={(e:any)=>setInvoice((v:any)=>({...v,poNumber:e.target.value}))}/>
          </div>
          <div className="field">
            <label className="label">支払期限（Payment Due）</label>
            <input type="date" className="input" value={invoice.paymentDue||""}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,paymentDue:e.target.value}))}/>
          </div>
        </div>

        <div className="field" style={{marginBottom:16}}>
          <label className="label"><span className="req">*</span>Shipper（出荷者）</label>
          <textarea className="input" value={invoice.shipper||""} rows={3} placeholder={"会社名\n住所\n国"}
            onChange={(e:any)=>setInvoice((v:any)=>({...v,shipper:e.target.value}))}/>
          {org?.companyName && (
            <button className="btn btn-secondary btn-sm" style={{alignSelf:"flex-start",marginTop:4}}
              onClick={() => setInvoice((v:any)=>({...v,shipper:[org.companyName,org.address].filter(Boolean).join("\n")}))}>
              ⚙️ 組織設定から入力
            </button>
          )}
        </div>

        {/* 得意先選択 */}
        {customers.length > 0 && (
          <div style={{marginBottom:12,padding:"12px 16px",background:"var(--blue-light)",borderRadius:"var(--radius-lg)"}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--blue)",marginBottom:8}}>得意先から自動入力</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {customers.map((c:any)=>(
                <button key={c.id} className="btn btn-secondary btn-sm" onClick={()=>applyCustomer(c)}>{c.name}</button>
              ))}
            </div>
          </div>
        )}

        <div className="grid-2" style={{marginBottom:16}}>
          <div className="field">
            <label className="label"><span className="req">*</span>Consignee（荷受人・書類上の宛先）</label>
            <textarea className="input" value={invoice.consignee||""} rows={3} placeholder={"会社名\n住所\n国"}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,consignee:e.target.value}))}/>
          </div>
          <div className="field">
            <label className="label">Ship To（納品先・実際の届け先）</label>
            <textarea className="input" value={invoice.shipTo||""} rows={3} placeholder={"Consigneeと異なる場合のみ入力\n会社名\n住所\n国"}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,shipTo:e.target.value}))}/>
            <div style={{fontSize:11,color:"var(--text-muted)"}}>空欄の場合はConsigneeと同じ扱いになります</div>
          </div>
        </div>
        <div className="field">
          <label className="label">Notify Party</label>
          <textarea className="input" value={invoice.notifyParty||""} rows={2} placeholder="通知先（L/C発行時など）"
            onChange={(e:any)=>setInvoice((v:any)=>({...v,notifyParty:e.target.value}))}/>
        </div>
      </div>

      {/* 貿易条件 */}
      <div className="card">
        <div className="card-header"><div className="card-title">🚢 貿易条件</div></div>
        <div className="grid-4">
          <div className="field">
            <label className="label"><span className="req">*</span>Incoterms</label>
            <select className="input" value={invoice.incoterms||""}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,incoterms:e.target.value}))}>
              <option value="">選択</option>
              {INCOTERMS.map((t:string)=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Shipping Method</label>
            <select className="input" value={invoice.shippingMethod||""}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,shippingMethod:e.target.value}))}>
              <option value="">選択</option>
              {SHIPPING_METHODS.map((m:string)=><option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label"><span className="req">*</span>Country of Origin</label>
            <AutocompleteInput value={invoice.countryOfOrigin||""} suggestions={COUNTRIES} placeholder="Japan"
              onChange={(val:string)=>setInvoice((v:any)=>({...v,countryOfOrigin:val}))}/>
          </div>
          <div className="field">
            <label className="label">Port of Loading</label>
            <input className="input" value={invoice.portOfLoading||""} placeholder="JPKIX"
              onChange={(e:any)=>setInvoice((v:any)=>({...v,portOfLoading:e.target.value}))}/>
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
                  <th style={{width:80}}>数量</th>
                  <th style={{width:100}}>単価</th>
                  <th style={{width:75}}>通貨</th>
                  <th style={{width:130}}>HSコード <span style={{color:"var(--red)"}}>*</span></th>
                  <th style={{width:100,textAlign:"right"}}>小計</th>
                  <th style={{width:36}}></th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item:any)=>{
                  const itemCurrency = item.currency || currency;
                  const subtotal = Number(item.quantity||0)*Number(item.unitPrice||0);
                  return (
                    <tr key={item.id}>
                      <td><input className="input" value={item.productName||""} placeholder="製品名" onChange={(e:any)=>updateItem(item.id,"productName",e.target.value)}/></td>
                      <td><input className="input" type="number" value={item.quantity||""} placeholder="0" onChange={(e:any)=>updateItem(item.id,"quantity",e.target.value)}/></td>
                      <td><input className="input" type="number" value={item.unitPrice||""} placeholder="0" onChange={(e:any)=>updateItem(item.id,"unitPrice",e.target.value)}/></td>
                      <td>
                        <select className="input" value={item.currency||currency} onChange={(e:any)=>updateItem(item.id,"currency",e.target.value)}>
                          {CURRENCIES.map((c:string)=><option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td>
                        <AutocompleteInput value={item.hsCode||""} suggestions={SAMPLE_HS_CODES}
                          className={!item.hsCode?"error":""} placeholder="0000.00"
                          onChange={(val:string)=>updateItem(item.id,"hsCode",val)}/>
                      </td>
                      <td style={{fontWeight:500,fontSize:13,textAlign:"right",paddingRight:8}}>{formatAmount(subtotal,itemCurrency)}</td>
                      <td><button className="btn btn-danger btn-xs" onClick={()=>removeItem(item.id)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {(invoice.items?.length>0)&&(
          <div className="total-row">
            <div>
              <div className="total-label">Total Amount</div>
              <div className="total-value">{currency} {formatAmount(total,currency)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">📝 備考</div></div>
        <div className="field">
          <textarea className="input" value={invoice.remarks||""} rows={3} placeholder="特記事項・通関上の注意事項など"
            onChange={(e:any)=>setInvoice((v:any)=>({...v,remarks:e.target.value}))}/>
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
  const addCarton = () => {
    const nextNo = packingItems.length + 1;
    setPackingItems((v:any[])=>[...v,{id:Date.now(),cartonNo:nextNo,lines:[{id:Date.now()+1,productName:"",quantity:""}],grossWeight:"",netWeight:"",dimL:"",dimW:"",dimH:""}]);
  };

  const updateCarton = (id:number, field:string, val:any) =>
    setPackingItems((v:any[])=>v.map((c:any)=>c.id===id?{...c,[field]:val}:c));

  const removeCarton = (id:number) =>
    setPackingItems((v:any[])=>v.filter((c:any)=>c.id!==id));

  const addLine = (cartonId:number) =>
    setPackingItems((v:any[])=>v.map((c:any)=>c.id===cartonId?{...c,lines:[...c.lines,{id:Date.now(),productName:"",quantity:""}]}:c));

  const updateLine = (cartonId:number,lineId:number,field:string,val:any) =>
    setPackingItems((v:any[])=>v.map((c:any)=>c.id===cartonId?{...c,lines:c.lines.map((l:any)=>l.id===lineId?{...l,[field]:val}:l)}:c));

  const removeLine = (cartonId:number,lineId:number) =>
    setPackingItems((v:any[])=>v.map((c:any)=>c.id===cartonId?{...c,lines:c.lines.filter((l:any)=>l.id!==lineId)}:c));

  const applyFromInvoice = () => {
    if (!invoice.items||invoice.items.length===0) return alert("Invoice品目を先に入力してください");
    const newCartons = invoice.items.map((it:any, i:number) => ({
      id: Date.now()+i, cartonNo: i+1,
      lines: [{id:Date.now()+i+100, productName:it.productName||"", quantity:it.quantity||""}],
      grossWeight:"", netWeight:"", dimL:"", dimW:"", dimH:"",
    }));
    setPackingItems(newCartons);
  };

  // 数量不一致チェック
  const invoiceQtyMap: any = {};
  (invoice.items||[]).forEach((it:any) => {
    if (it.productName) invoiceQtyMap[it.productName] = (invoiceQtyMap[it.productName]||0) + Number(it.quantity||0);
  });
  const packingQtyMap: any = {};
  packingItems.forEach((c:any)=>{
    (c.lines||[]).forEach((l:any)=>{
      if (l.productName) packingQtyMap[l.productName] = (packingQtyMap[l.productName]||0) + Number(l.quantity||0);
    });
  });
  const mismatch = Object.keys(invoiceQtyMap).filter(name =>
    packingQtyMap[name] !== undefined && invoiceQtyMap[name] !== packingQtyMap[name]
  );

  const totalGW = packingItems.reduce((s:number,c:any)=>s+Number(c.grossWeight||0),0);
  const totalNW = packingItems.reduce((s:number,c:any)=>s+Number(c.netWeight||0),0);

  return (
    <div className="fade-in">
      {mismatch.length > 0 && (
        <div style={{background:"var(--red-light)",border:"1px solid var(--red-mid)",borderRadius:"var(--radius-xl)",padding:"12px 16px",marginBottom:16}}>
          <div style={{fontWeight:600,color:"var(--red)",marginBottom:4}}>⚠️ Invoice数量と不一致の製品があります</div>
          {mismatch.map(name=>(
            <div key={name} style={{fontSize:12,color:"var(--red)"}}>
              {name}: Invoice {invoiceQtyMap[name]} ／ Packing {packingQtyMap[name]||0}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div><div className="card-title">📦 梱包明細</div><div className="card-subtitle">寸法はL×W×H (cm)で入力</div></div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-secondary btn-sm" onClick={applyFromInvoice}>📋 Invoiceから反映</button>
            <button className="btn btn-primary btn-sm" onClick={addCarton}>+ カートン追加</button>
          </div>
        </div>

        {packingItems.length===0 ? (
          <div className="empty-state"><div className="empty-icon">📦</div>
            <div style={{fontSize:14}}>カートンを追加してください</div>
            <button className="btn btn-secondary btn-sm" style={{marginTop:12}} onClick={applyFromInvoice}>📋 Invoiceから自動反映</button>
          </div>
        ) : packingItems.map((carton:any)=>(
          <div key={carton.id} className="carton-block">
            <div className="carton-header">
              <div style={{fontWeight:600,fontSize:13}}>📦 カートン {carton.cartonNo}</div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <label style={{fontSize:11,color:"var(--text-muted)",whiteSpace:"nowrap"}}>総重量(kg)<span style={{color:"var(--red)"}}>*</span></label>
                  <input className="input" type="number" style={{width:80}} value={carton.grossWeight||""} placeholder="0.00"
                    onChange={(e:any)=>updateCarton(carton.id,"grossWeight",e.target.value)}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <label style={{fontSize:11,color:"var(--text-muted)",whiteSpace:"nowrap"}}>正味重量(kg)</label>
                  <input className="input" type="number" style={{width:80}} value={carton.netWeight||""} placeholder="0.00"
                    onChange={(e:any)=>updateCarton(carton.id,"netWeight",e.target.value)}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <label style={{fontSize:11,color:"var(--text-muted)",whiteSpace:"nowrap"}}>寸法(cm)</label>
                  <div className="dim-input-row">
                    <input className="input" type="number" value={carton.dimL||""} placeholder="L"
                      onChange={(e:any)=>updateCarton(carton.id,"dimL",e.target.value)}/>
                    <span className="dim-sep">×</span>
                    <input className="input" type="number" value={carton.dimW||""} placeholder="W"
                      onChange={(e:any)=>updateCarton(carton.id,"dimW",e.target.value)}/>
                    <span className="dim-sep">×</span>
                    <input className="input" type="number" value={carton.dimH||""} placeholder="H"
                      onChange={(e:any)=>updateCarton(carton.id,"dimH",e.target.value)}/>
                  </div>
                </div>
                <button className="btn btn-danger btn-xs" onClick={()=>removeCarton(carton.id)}>カートン削除</button>
              </div>
            </div>
            <div className="carton-lines">
              {carton.lines.map((line:any, li:number)=>(
                <div key={line.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:11,color:"var(--text-muted)",minWidth:16}}>{li+1}.</span>
                  <input className="input" value={line.productName||""} placeholder="製品名"
                    style={{flex:2}} onChange={(e:any)=>updateLine(carton.id,line.id,"productName",e.target.value)}/>
                  <input className="input" type="number" value={line.quantity||""} placeholder="数量"
                    style={{width:80}} onChange={(e:any)=>updateLine(carton.id,line.id,"quantity",e.target.value)}/>
                  {carton.lines.length > 1 && (
                    <button className="btn btn-danger btn-xs" onClick={()=>removeLine(carton.id,line.id)}>✕</button>
                  )}
                </div>
              ))}
              <button className="btn btn-secondary btn-xs" style={{marginTop:4}} onClick={()=>addLine(carton.id)}>
                + 混載品目追加
              </button>
            </div>
          </div>
        ))}

        {packingItems.length > 0 && (
          <div className="total-row" style={{marginTop:0}}>
            <div><div className="total-label">カートン数</div><div className="total-value">{packingItems.length} CTN</div></div>
            <div><div className="total-label">総重量合計</div><div className="total-value">{totalGW.toFixed(2)} kg</div></div>
            <div><div className="total-label">正味重量合計</div><div className="total-value">{totalNW.toFixed(2)} kg</div></div>
          </div>
        )}
      </div>

      <div style={{display:"flex",justifyContent:"space-between"}}>
        <button className="btn btn-secondary" onClick={onBack}>← Invoice入力に戻る</button>
        <button className="btn btn-primary" onClick={onNext}>内容確認へ →</button>
      </div>
    </div>
  );
}

// ============================================================
// REVIEW PAGE
// ============================================================
function ReviewPage({invoice, packingItems, onNext, onBack, setStep}: any) {
  const {errors, warnings, riskLevel} = runValidation(invoice, packingItems);
  const canProceed = errors.length === 0;

  const checks = [
    {label:"Invoice No入力",ok:!!invoice.invoiceNo},
    {label:"作成日付入力",ok:!!invoice.date},
    {label:"通貨選択",ok:!!invoice.currency},
    {label:"Incoterms選択",ok:!!invoice.incoterms},
    {label:"原産国入力",ok:!!invoice.countryOfOrigin},
    {label:"品目あり",ok:(invoice.items||[]).length>0},
    {label:"HSコード全入力",ok:(invoice.items||[]).length>0&&(invoice.items||[]).every((i:any)=>i.hsCode)},
    {label:"カートンあり",ok:packingItems.length>0},
    {label:"全カートン重量入力",ok:packingItems.length>0&&packingItems.every((c:any)=>c.grossWeight&&Number(c.grossWeight)>0)},
  ];

  return (
    <div className="fade-in">
      <ValidationPanel invoice={invoice} packingItems={packingItems} onJumpStep={setStep}/>
      <div className="card">
        <div className="card-header"><div className="card-title">✅ 内容確認チェックリスト</div></div>
        {checks.map((c,i)=>(
          <div key={i} className="checklist-item">
            <div className={`check-icon ${c.ok?"check-ok":"check-fail"}`}>{c.ok?"✓":"✕"}</div>
            <span style={{color:c.ok?"var(--text)":"var(--red)"}}>{c.label}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">📋 Invoice サマリー</div></div>
        <div className="grid-2">
          <div><span style={{color:"var(--text-muted)",fontSize:12}}>Invoice No</span><div style={{fontWeight:600}}>{invoice.invoiceNo||"—"}</div></div>
          <div><span style={{color:"var(--text-muted)",fontSize:12}}>日付</span><div>{invoice.date||"—"}</div></div>
          <div><span style={{color:"var(--text-muted)",fontSize:12}}>Consignee</span><div style={{whiteSpace:"pre-wrap",fontSize:13}}>{invoice.consignee?.split("\n")[0]||"—"}</div></div>
          <div><span style={{color:"var(--text-muted)",fontSize:12}}>通貨 / Incoterms</span><div>{invoice.currency} / {invoice.incoterms||"—"}</div></div>
          <div><span style={{color:"var(--text-muted)",fontSize:12}}>品目数</span><div>{(invoice.items||[]).length} 件</div></div>
          <div><span style={{color:"var(--text-muted)",fontSize:12}}>カートン数</span><div>{packingItems.length} CTN</div></div>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <button className="btn btn-secondary" onClick={onBack}>← Packing List修正</button>
        <button className={`btn ${canProceed?"btn-primary":"btn-secondary"}`} onClick={()=>canProceed?onNext():alert("エラーを解消してからPDF生成に進んでください")}
          style={canProceed?{}:{cursor:"not-allowed",opacity:0.6}}>
          {canProceed?"📄 PDF生成へ →":"⚠️ エラーがあります"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// OUTPUT PAGE (PDF)
// ============================================================
function OutputPage({invoice, packingItems, onBack, org}: any) {
  const [activeDoc, setActiveDoc] = useState("invoice");
  const total = (invoice.items||[]).reduce((s:number,it:any)=>s+(Number(it.quantity||0)*Number(it.unitPrice||0)),0);
  const currency = invoice.currency || "JPY";
  const isProforma = invoice.invoiceType === "proforma";

  const packingRows: any[] = [];
  packingItems.forEach((carton:any)=>{
    (carton.lines||[]).forEach((line:any,li:number)=>{
      const dimStr = [carton.dimL,carton.dimW,carton.dimH].filter(Boolean).join("×") || "—";
      packingRows.push({
        cartonNo: li===0?carton.cartonNo:"",
        productName: line.productName, quantity: line.quantity,
        grossWeight: li===0?Number(carton.grossWeight||0).toFixed(2):"",
        netWeight: li===0?Number(carton.netWeight||0).toFixed(2):"",
        dimensions: li===0?dimStr:"",
        isFirst: li===0,
      });
    });
  });

  const handlePrint = () => {
    const content = document.getElementById("print-area");
    const w = window.open("","","width=900,height=1200");
    if (!w||!content) return;
    w.document.write(`<html><head><title>${activeDoc==="invoice"?(isProforma?"Proforma Invoice":"Commercial Invoice"):"Packing List"}</title>
      <style>*{font-family:sans-serif;font-size:11px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 7px}th{background:#f5f5f5;font-size:10px}h1{font-size:20px;font-weight:700;letter-spacing:2px;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:14px}.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px}.meta-item{padding:4px 0;border-bottom:1px solid #eee}.meta-key{font-size:9px;font-weight:600;text-transform:uppercase;color:#666}.total-section{margin-top:14px;text-align:right;border-top:2px solid #000;padding-top:10px}.bank-section{margin-top:16px;padding:10px;border:1px solid #ddd;border-radius:4px;background:#fafafa;font-size:10px}.sig-box{text-align:center;border-top:1px solid #000;padding-top:8px;min-width:200px;margin-left:auto;margin-top:24px}</style>
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
              {org?.companyName && (
                <div style={{marginBottom:12,paddingBottom:12,borderBottom:"1px solid #eee"}}>
                  <div style={{fontSize:14,fontWeight:700}}>{org.companyName}</div>
                  {org.address&&<div style={{fontSize:10,color:"#666"}}>{org.address}</div>}
                  {(org.tel||org.email)&&<div style={{fontSize:10,color:"#666"}}>{[org.tel,org.email].filter(Boolean).join(" | ")}</div>}
                </div>
              )}
              <h1>{isProforma?"PROFORMA INVOICE":"COMMERCIAL INVOICE"}</h1>
              <div className="meta-grid">
                <div className="meta-item"><div className="meta-key">Invoice No.</div><strong>{invoice.invoiceNo||"—"}</strong></div>
                <div className="meta-item"><div className="meta-key">Date</div>{invoice.date||"—"}</div>
                <div className="meta-item"><div className="meta-key">Incoterms</div>{invoice.incoterms||"—"}</div>
                <div className="meta-item"><div className="meta-key">Country of Origin</div>{invoice.countryOfOrigin||"—"}</div>
                {invoice.poNumber&&<div className="meta-item"><div className="meta-key">P.O. Number</div>{invoice.poNumber}</div>}
                {invoice.paymentDue&&<div className="meta-item"><div className="meta-key">Payment Due</div>{invoice.paymentDue}</div>}
                {invoice.shippingMethod&&<div className="meta-item"><div className="meta-key">Shipping</div>{invoice.shippingMethod}</div>}
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
                  {(invoice.items||[]).map((it:any,i:number)=>(
                    <tr key={i}><td>{it.productName}</td><td style={{fontFamily:"monospace"}}>{it.hsCode}</td>
                    <td style={{textAlign:"right"}}>{it.quantity}</td>
                    <td style={{textAlign:"right"}}>{currency} {formatAmount(Number(it.unitPrice||0),currency)}</td>
                    <td style={{textAlign:"right"}}>{currency} {formatAmount(Number(it.quantity||0)*Number(it.unitPrice||0),currency)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="total-section"><strong>TOTAL: {currency} {formatAmount(total,currency)}</strong></div>
              {invoice.remarks&&<div style={{marginTop:16,fontSize:11}}><strong>Remarks:</strong> {invoice.remarks}</div>}
              {/* 銀行情報 */}
              {org?.bankName && (
                <div className="bank-section">
                  <div style={{fontWeight:700,marginBottom:6,fontSize:11}}>BANKING DETAILS</div>
                  <div>Bank: {org.bankName}{org.bankBranch?` / ${org.bankBranch}`:""}</div>
                  {org.accountType&&<div>Account Type: {org.accountType}</div>}
                  {org.accountNo&&<div>Account No: {org.accountNo}</div>}
                  {org.accountName&&<div>Account Name: {org.accountName}</div>}
                  {org.swiftCode&&<div>SWIFT: {org.swiftCode}</div>}
                </div>
              )}
              {/* 署名 */}
              {org?.signerName && (
                <div className="sig-box" style={{textAlign:"center",borderTop:"1px solid #000",paddingTop:8,minWidth:200,marginLeft:"auto",marginTop:24}}>
                  <div style={{fontSize:11}}>{org.signerName}</div>
                  {org.signerTitle&&<div style={{fontSize:10,color:"#666"}}>{org.signerTitle}</div>}
                  {org.companyName&&<div style={{fontSize:10,color:"#666"}}>{org.companyName}</div>}
                </div>
              )}
            </>
          ) : (
            <>
              {org?.companyName && (
                <div style={{marginBottom:12,paddingBottom:12,borderBottom:"1px solid #eee"}}>
                  <div style={{fontSize:14,fontWeight:700}}>{org.companyName}</div>
                  {org.address&&<div style={{fontSize:10,color:"#666"}}>{org.address}</div>}
                </div>
              )}
              <h1>PACKING LIST</h1>
              <div className="meta-grid">
                <div className="meta-item"><div className="meta-key">Invoice No.</div><strong>{invoice.invoiceNo||"—"}</strong></div>
                <div className="meta-item"><div className="meta-key">Date</div>{invoice.date||"—"}</div>
                <div className="meta-item"><div className="meta-key">Total Cartons</div>{packingItems.length} CTNS</div>
                <div className="meta-item"><div className="meta-key">Total G.W.</div>{packingItems.reduce((s:number,c:any)=>s+Number(c.grossWeight||0),0).toFixed(2)} kg</div>
                {invoice.consignee&&<div className="meta-item"><div className="meta-key">Consignee</div>{invoice.consignee.split("\n")[0]}</div>}
              </div>
              <table>
                <thead><tr><th>Carton No</th><th>Description</th><th style={{textAlign:"right"}}>Qty</th><th style={{textAlign:"right"}}>G.W.(kg)</th><th style={{textAlign:"right"}}>N.W.(kg)</th><th>Dimensions(cm)</th></tr></thead>
                <tbody>
                  {packingRows.map((row:any,i:number)=>(
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
                    <th style={{textAlign:"right"}}>{packingRows.reduce((s:number,r:any)=>s+(Number(r.quantity)||0),0)}</th>
                    <th style={{textAlign:"right"}}>{packingItems.reduce((s:number,c:any)=>s+Number(c.grossWeight||0),0).toFixed(2)}</th>
                    <th style={{textAlign:"right"}}>{packingItems.reduce((s:number,c:any)=>s+Number(c.netWeight||0),0).toFixed(2)}</th>
                    <th></th>
                  </tr>
                </tfoot>
              </table>
              {org?.signerName && (
                <div style={{textAlign:"center",borderTop:"1px solid #000",paddingTop:8,minWidth:200,marginLeft:"auto",marginTop:24}}>
                  <div style={{fontSize:11}}>{org.signerName}</div>
                  {org.signerTitle&&<div style={{fontSize:10,color:"#666"}}>{org.signerTitle}</div>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <button className="btn btn-secondary" onClick={onBack}>← 内容確認に戻る</button>
        <button className="btn btn-primary" onClick={()=>alert("メール送信機能は今後対応予定です")}>📧 メール送付へ →</button>
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

  useEffect(()=>{ fetchInvoices(); },[fetchInvoices]);

  const deleteInvoice = async (id:string, e:any) => {
    e.stopPropagation();
    if (!confirm("削除しますか？")) return;
    await supabaseRequest(`invoices?id=eq.${id}`,{method:"DELETE"});
    fetchInvoices();
  };

  const filtered = invoices.filter(h=>{
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
            {["all","draft","in_progress","shipped","completed"].map(s=>(
              <button key={s} className={`btn btn-sm ${filterStatus===s?"btn-primary":"btn-secondary"}`} onClick={()=>setFilterStatus(s)}>
                {s==="all"?"全て":statusLabel[s]||s}
              </button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <input className="input" placeholder="🔍 Invoice No・得意先・国で検索..." value={search} onChange={(e:any)=>setSearch(e.target.value)}/>
        </div>
        {loading ? (
          <div style={{textAlign:"center",padding:32}}><div className="spinner"></div></div>
        ) : filtered.length===0 ? (
          <div className="empty-state"><div className="empty-icon">📭</div><div style={{fontSize:14}}>保存済みの案件がありません</div></div>
        ) : filtered.map(h=>(
          <div key={h.id} className="history-item" onClick={()=>onLoad(h)}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
              <strong style={{fontSize:14}}>{h.invoice_no||"No Invoice No"}</strong>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span className={`status-badge status-${h.status||"draft"}`}>● {statusLabel[h.status||"draft"]}</span>
                <button className="btn btn-danger btn-xs" onClick={(e)=>deleteInvoice(h.id,e)}>削除</button>
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
  const EMPTY_FORM = {name:"",address:"",consignee_name:"",consignee_address:"",country:"Japan",currency:"JPY",incoterms:"",contact:"",email:""};
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supabaseRequest("customers?order=created_at.desc");
      setCustomers(data||[]);
      onCustomersChange(data||[]);
    } catch(e) { console.error(e); }
    setLoading(false);
  },[onCustomersChange]);

  useEffect(()=>{ fetchCustomers(); },[fetchCustomers]);

  const save = async () => {
    if (!form.name.trim()) return alert("会社名を入力してください");
    await supabaseRequest("customers",{method:"POST",body:JSON.stringify(form)});
    setForm(EMPTY_FORM); setShowForm(false); fetchCustomers();
  };

  const deleteCustomer = async (id:string) => {
    if (!confirm("削除しますか？")) return;
    await supabaseRequest(`customers?id=eq.${id}`,{method:"DELETE"});
    fetchCustomers();
  };

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">🏢 得意先マスタ</div><div className="card-subtitle">Consignee（荷受人）とShip To（納品先）を登録できます</div></div>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(v=>!v)}>+ 得意先追加</button>
        </div>
        {showForm && (
          <div style={{background:"#F7F7F5",borderRadius:"var(--radius-lg)",padding:16,marginBottom:16}}>
            <div className="org-section-title" style={{marginBottom:12}}>📋 Consignee（荷受人・書類上の宛先）</div>
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
            <div className="grid-4" style={{marginBottom:16}}>
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

            <div className="ship-to-box">
              <div className="org-section-title" style={{color:"var(--blue)",borderColor:"var(--blue)",marginBottom:6}}>🚚 Ship To（納品先・実際の届け先）</div>
              <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:12}}>Consigneeと実際の届け先が異なる場合のみ入力。Invoice の「SHIP TO」欄に自動反映されます。</div>
              <div className="field" style={{marginBottom:12}}>
                <label className="label">納品先会社名</label>
                <input className="input" value={form.consignee_name} placeholder="Warehouse Co., Ltd." onChange={(e:any)=>setForm(v=>({...v,consignee_name:e.target.value}))}/>
              </div>
              <div className="field">
                <label className="label">納品先住所</label>
                <textarea className="input" rows={2} value={form.consignee_address} placeholder={"住所\n国"} onChange={(e:any)=>setForm(v=>({...v,consignee_address:e.target.value}))}/>
              </div>
            </div>

            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button className="btn btn-primary btn-sm" onClick={save}>保存</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>setShowForm(false)}>キャンセル</button>
            </div>
          </div>
        )}
        {loading ? (
          <div style={{textAlign:"center",padding:32}}><div className="spinner"></div></div>
        ) : customers.length===0 ? (
          <div className="empty-state"><div className="empty-icon">🏢</div><div style={{fontSize:14}}>得意先を登録してください</div></div>
        ) : customers.map((c:any)=>(
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
                <span style={{color:"var(--blue)",fontWeight:600}}>🚚 Ship To: </span>{c.consignee_name}
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
  const EMPTY = {name:"",hs_code:"",unit:"pcs",unit_price:"",currency:"JPY",weight:""};
  const [form, setForm] = useState(EMPTY);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supabaseRequest("products?order=created_at.desc");
      setProducts(data||[]);
    } catch(e) { console.error(e); }
    setLoading(false);
  },[]);

  useEffect(()=>{ fetchProducts(); },[fetchProducts]);

  const save = async () => {
    if (!form.name.trim()) return alert("製品名を入力してください");
    await supabaseRequest("products",{method:"POST",body:JSON.stringify({...form,unit_price:form.unit_price?Number(form.unit_price):null,weight:form.weight?Number(form.weight):null})});
    setForm(EMPTY); setShowForm(false); fetchProducts();
  };

  const deleteProduct = async (id:string) => {
    if (!confirm("削除しますか？")) return;
    await supabaseRequest(`products?id=eq.${id}`,{method:"DELETE"});
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
              <div className="field"><label className="label">HSコード</label>
                <AutocompleteInput value={form.hs_code} suggestions={SAMPLE_HS_CODES} placeholder="0000.00" onChange={(val:string)=>setForm(v=>({...v,hs_code:val}))}/></div>
            </div>
            <div className="grid-4" style={{marginBottom:12}}>
              <div className="field"><label className="label">単位</label>
                <input className="input" value={form.unit} placeholder="pcs" onChange={(e:any)=>setForm(v=>({...v,unit:e.target.value}))}/></div>
              <div className="field"><label className="label">標準単価</label>
                <input className="input" type="number" value={form.unit_price} placeholder="0" onChange={(e:any)=>setForm(v=>({...v,unit_price:e.target.value}))}/></div>
              <div className="field"><label className="label">通貨</label>
                <select className="input" value={form.currency} onChange={(e:any)=>setForm(v=>({...v,currency:e.target.value}))}>
                  {CURRENCIES.map((c:string)=><option key={c}>{c}</option>)}</select></div>
              <div className="field"><label className="label">重量(kg/個)</label>
                <input className="input" type="number" value={form.weight} placeholder="0.00" onChange={(e:any)=>setForm(v=>({...v,weight:e.target.value}))}/></div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-primary btn-sm" onClick={save}>保存</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>setShowForm(false)}>キャンセル</button>
            </div>
          </div>
        )}
        {loading ? (
          <div style={{textAlign:"center",padding:32}}><div className="spinner"></div></div>
        ) : products.length===0 ? (
          <div className="empty-state"><div className="empty-icon">🗂️</div><div style={{fontSize:14}}>製品を登録してください</div></div>
        ) : products.map((p:any)=>(
          <div key={p.id} className="history-item">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <strong style={{fontSize:14}}>{p.name}</strong>
              <button className="btn btn-danger btn-xs" onClick={()=>deleteProduct(p.id)}>削除</button>
            </div>
            <div className="history-meta" style={{marginTop:6}}>
              {p.hs_code&&<span className="tag tag-blue" style={{fontFamily:"monospace"}}>{p.hs_code}</span>}
              {p.unit&&<span className="tag tag-gray">{p.unit}</span>}
              {p.unit_price&&<span className="tag tag-green">{p.currency} {p.unit_price}</span>}
              {p.weight&&<span className="tag tag-amber">{p.weight} kg</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ORGANIZATION SETTINGS PAGE
// ============================================================
function OrgSettingsPage({org, setOrg}: any) {
  const [form, setForm] = useState(org);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setOrg(form);
    localStorage.setItem("tradeOrgSettings", JSON.stringify(form));
    setSaved(true);
    setTimeout(()=>setSaved(false), 3000);
  };

  return (
    <div className="fade-in">
      {saved && (
        <div className="saved-banner">✅ 組織設定を保存しました。PDF出力時に自動反映されます。</div>
      )}

      <div className="card">
        <div className="card-header">
          <div><div className="card-title">⚙️ 組織設定</div><div className="card-subtitle">自社情報を登録。Invoice・Packing Listに自動反映されます。</div></div>
          <button className="btn btn-green btn-sm" onClick={save}>💾 保存</button>
        </div>

        {/* 自社情報 */}
        <div className="org-section">
          <div className="org-section-title">🏢 自社情報</div>
          <div className="field" style={{marginBottom:14}}>
            <label className="label"><span className="req">*</span>会社名（英語）</label>
            <input className="input" value={form.companyName||""} placeholder="Your Company Co., Ltd."
              onChange={(e:any)=>setForm((v:any)=>({...v,companyName:e.target.value}))}/>
          </div>
          <div className="field" style={{marginBottom:14}}>
            <label className="label">住所（英語）</label>
            <textarea className="input" rows={3} value={form.address||""} placeholder={"1-1-1 Example, Nagoya,\nAichi 460-0001, Japan"}
              onChange={(e:any)=>setForm((v:any)=>({...v,address:e.target.value}))}/>
          </div>
          <div className="grid-3" style={{marginBottom:14}}>
            <div className="field"><label className="label">電話番号</label>
              <input className="input" value={form.tel||""} placeholder="+81-52-000-0000"
                onChange={(e:any)=>setForm((v:any)=>({...v,tel:e.target.value}))}/></div>
            <div className="field"><label className="label">メールアドレス</label>
              <input className="input" value={form.email||""} placeholder="export@yourcompany.com"
                onChange={(e:any)=>setForm((v:any)=>({...v,email:e.target.value}))}/></div>
            <div className="field"><label className="label">Webサイト</label>
              <input className="input" value={form.website||""} placeholder="https://yourcompany.com"
                onChange={(e:any)=>setForm((v:any)=>({...v,website:e.target.value}))}/></div>
          </div>
        </div>

        {/* 銀行口座情報 */}
        <div className="org-section">
          <div className="org-section-title">🏦 銀行口座情報（Invoiceに印刷）</div>
          <div className="grid-2" style={{marginBottom:14}}>
            <div className="field"><label className="label">銀行名（英語）</label>
              <input className="input" value={form.bankName||""} placeholder="MUFG Bank, Ltd."
                onChange={(e:any)=>setForm((v:any)=>({...v,bankName:e.target.value}))}/></div>
            <div className="field"><label className="label">支店名</label>
              <input className="input" value={form.bankBranch||""} placeholder="Nagoya Branch"
                onChange={(e:any)=>setForm((v:any)=>({...v,bankBranch:e.target.value}))}/></div>
          </div>
          <div className="grid-4" style={{marginBottom:14}}>
            <div className="field"><label className="label">口座種別</label>
              <select className="input" value={form.accountType||""} onChange={(e:any)=>setForm((v:any)=>({...v,accountType:e.target.value}))}>
                <option value="">選択</option>
                <option value="Ordinary">普通（Ordinary）</option>
                <option value="Checking">当座（Checking）</option>
              </select></div>
            <div className="field"><label className="label">口座番号</label>
              <input className="input" value={form.accountNo||""} placeholder="1234567"
                onChange={(e:any)=>setForm((v:any)=>({...v,accountNo:e.target.value}))}/></div>
            <div className="field"><label className="label">口座名義（英語）</label>
              <input className="input" value={form.accountName||""} placeholder="YOUR COMPANY CO LTD"
                onChange={(e:any)=>setForm((v:any)=>({...v,accountName:e.target.value}))}/></div>
            <div className="field"><label className="label">SWIFTコード</label>
              <input className="input" value={form.swiftCode||""} placeholder="BOTKJPJT"
                onChange={(e:any)=>setForm((v:any)=>({...v,swiftCode:e.target.value}))}/></div>
          </div>
          {(form.bankName||form.accountNo) && (
            <div style={{background:"#F7F7F5",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:12,fontSize:12}}>
              <div style={{fontWeight:600,marginBottom:4,fontSize:11,color:"var(--text-muted)"}}>PDF印刷プレビュー</div>
              <div>Bank: {form.bankName||"—"}{form.bankBranch?` / ${form.bankBranch}`:""}</div>
              {form.accountType&&<div>Account Type: {form.accountType}</div>}
              {form.accountNo&&<div>Account No: {form.accountNo}</div>}
              {form.accountName&&<div>Account Name: {form.accountName}</div>}
              {form.swiftCode&&<div>SWIFT: {form.swiftCode}</div>}
            </div>
          )}
        </div>

        {/* 署名 */}
        <div className="org-section">
          <div className="org-section-title">✍️ 署名・担当者情報</div>
          <div className="grid-2">
            <div className="field"><label className="label">署名者名（英語）</label>
              <input className="input" value={form.signerName||""} placeholder="Taro Yamada"
                onChange={(e:any)=>setForm((v:any)=>({...v,signerName:e.target.value}))}/></div>
            <div className="field"><label className="label">役職（英語）</label>
              <input className="input" value={form.signerTitle||""} placeholder="Export Manager"
                onChange={(e:any)=>setForm((v:any)=>({...v,signerTitle:e.target.value}))}/></div>
          </div>
          {form.signerName && (
            <div style={{marginTop:14,padding:16,background:"#F7F7F5",borderRadius:"var(--radius)",textAlign:"center",display:"inline-block",minWidth:200,border:"1px solid var(--border)"}}>
              <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:24}}>署名プレビュー</div>
              <div style={{borderTop:"1px solid var(--border-strong)",paddingTop:8,textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:600}}>{form.signerName}</div>
                {form.signerTitle&&<div style={{fontSize:11,color:"var(--text-muted)"}}>{form.signerTitle}</div>}
                {form.companyName&&<div style={{fontSize:11,color:"var(--text-muted)"}}>{form.companyName}</div>}
              </div>
            </div>
          )}
        </div>

        <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
          <button className="btn btn-green" onClick={save}>💾 設定を保存</button>
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
  const [step, setStep] = useState(1);
  const [invoice, setInvoice] = useState<any>(INITIAL_INVOICE);
  const [packingItems, setPackingItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [org, setOrg] = useState<any>(INITIAL_ORG);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string|null>(null);

  // 組織設定をlocalStorageから読み込む
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tradeOrgSettings");
      if (saved) setOrg(JSON.parse(saved));
    } catch(e) {}
  }, []);

  const reset = () => { setInvoice(INITIAL_INVOICE); setPackingItems([]); setStep(1); setPage("new"); };

  // 下書き保存（Supabase）
  const saveDraft = async () => {
    setSaving(true);
    try {
      const payload = {
        invoice_no: invoice.invoiceNo || null,
        invoice_type: invoice.invoiceType,
        date: invoice.date || null,
        po_number: invoice.poNumber || null,
        payment_due: invoice.paymentDue || null,
        shipper: invoice.shipper || null,
        consignee: invoice.consignee || null,
        ship_to: invoice.shipTo || null,
        notify_party: invoice.notifyParty || null,
        currency: invoice.currency || "JPY",
        incoterms: invoice.incoterms || null,
        country_of_origin: invoice.countryOfOrigin || null,
        shipping_method: invoice.shippingMethod || null,
        port_of_loading: invoice.portOfLoading || null,
        remarks: invoice.remarks || null,
        items: invoice.items || [],
        packing_items: packingItems,
        status: "draft",
      };
      if (invoice._supabaseId) {
        await supabaseRequest(`invoices?id=eq.${invoice._supabaseId}`, {
          method: "PATCH", headers:{"Prefer":"return=representation"},
          body: JSON.stringify(payload),
        });
      } else {
        const res = await supabaseRequest("invoices", {method:"POST", body:JSON.stringify(payload)});
        if (res && res[0]) {
          setInvoice((v:any) => ({...v, _supabaseId: res[0].id}));
        }
      }
      const now = new Date().toLocaleTimeString("ja-JP");
      setLastSaved(now);
    } catch(e:any) {
      alert("保存に失敗しました。Supabaseの接続を確認してください。\n" + e.message);
    }
    setSaving(false);
  };

  // 保存済みから読み込む
  const loadHistory = (h: any) => {
    setInvoice({
      ...INITIAL_INVOICE,
      _supabaseId: h.id,
      invoiceNo: h.invoice_no||"",
      invoiceType: h.invoice_type||"commercial",
      date: h.date||"",
      poNumber: h.po_number||"",
      paymentDue: h.payment_due||"",
      shipper: h.shipper||"",
      consignee: h.consignee||"",
      shipTo: h.ship_to||"",
      notifyParty: h.notify_party||"",
      currency: h.currency||"JPY",
      incoterms: h.incoterms||"",
      countryOfOrigin: h.country_of_origin||"Japan",
      shippingMethod: h.shipping_method||"",
      portOfLoading: h.port_of_loading||"",
      remarks: h.remarks||"",
      items: h.items||[],
    });
    setPackingItems(h.packing_items||[]);
    setStep(1); setPage("new");
  };

  const navItems = [
    {id:"new",label:"新規作成",icon:"✏️"},
    {id:"history",label:"保存済み案件",icon:"📚"},
    {id:"customers",label:"得意先マスタ",icon:"🏢"},
    {id:"products",label:"製品マスタ",icon:"🗂️"},
    {id:"settings",label:"組織設定",icon:"⚙️"},
  ];

  const topbarTitle: any = {
    new:"新規書類作成",history:"保存済み案件",
    customers:"得意先マスタ",products:"製品マスタ",settings:"組織設定",
  };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-text">🚢 TradeDoc</div>
            <div className="logo-sub">{org.companyName || "貿易書類管理システム"}</div>
          </div>
          <nav className="sidebar-nav">
            <div className="nav-label">メニュー</div>
            {navItems.map(n=>(
              <button key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={()=>setPage(n.id)}>
                <span className="nav-icon">{n.icon}</span>{n.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="topbar-title">{topbarTitle[page]||"TradeDoc"}</div>
            <div className="topbar-actions">
              {page==="new"&&(
                <>
                  {lastSaved&&<span style={{fontSize:12,color:"var(--green)"}}>✅ {lastSaved} 保存済み</span>}
                  <button className="btn btn-green btn-sm" onClick={saveDraft} style={{minWidth:100}}>
                    {saving?<><span className="spinner"></span> 保存中…</>:"💾 下書き保存"}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={reset}>🔄 リセット</button>
                </>
              )}
            </div>
          </div>
          <div className="content">
            {page==="new"&&(
              <>
                <StepBar currentStep={step} setStep={setStep}/>
                {step===1&&<InvoiceForm invoice={invoice} setInvoice={setInvoice} onNext={()=>setStep(2)} customers={customers} org={org}/>}
                {step===2&&<PackingListForm invoice={invoice} packingItems={packingItems} setPackingItems={setPackingItems} onNext={()=>setStep(3)} onBack={()=>setStep(1)}/>}
                {step===3&&<ReviewPage invoice={invoice} packingItems={packingItems} onNext={()=>setStep(4)} onBack={()=>setStep(2)} setStep={setStep}/>}
                {step>=4&&<OutputPage invoice={invoice} packingItems={packingItems} onBack={()=>setStep(3)} org={org}/>}
              </>
            )}
            {page==="history"&&<HistoryPage onLoad={loadHistory}/>}
            {page==="customers"&&<CustomerMasterPage onCustomersChange={setCustomers}/>}
            {page==="products"&&<ProductMasterPage/>}
            {page==="settings"&&<OrgSettingsPage org={org} setOrg={setOrg}/>}
          </div>
        </main>
      </div>
    </>
  );
}
