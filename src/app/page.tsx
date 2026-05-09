"use client";
import { useState, useEffect, useCallback, useMemo } from "react";

// ============================================================
// TYPES & CONSTANTS
// ============================================================
const CURRENCIES = ["USD", "EUR", "JPY", "GBP", "SGD", "HKD", "AUD", "CNY"];
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
  {code:"6204.62",desc:"Women's trousers of cotton"},
  {code:"6110.20",desc:"Jerseys / pullovers of cotton"},
  {code:"3004.90",desc:"Medicaments (mixed, retail)"},
  {code:"2106.90",desc:"Food preparations NEC"},
];

const STEPS = [
  {id:1,label:"Invoice入力",icon:"📋"},
  {id:2,label:"Packing List",icon:"📦"},
  {id:3,label:"内容確認",icon:"✅"},
  {id:4,label:"PDF生成",icon:"📄"},
  {id:5,label:"メール送付",icon:"📧"},
  {id:6,label:"出荷完了",icon:"🚢"},
];

const SAMPLE_HISTORY = [
  {id:"INV-2024-001",date:"2024-11-15",customer:"ABC Electronics Co., Ltd.",country:"United States",product:"LCD Monitor 24inch",qty:100,currency:"USD",total:18500,status:"completed",hsCode:"8528.72"},
  {id:"INV-2024-002",date:"2024-11-28",customer:"Global Tech GmbH",country:"Germany",product:"USB-C Cable 1m",qty:500,currency:"EUR",total:3250,status:"shipped",hsCode:"8544.42"},
  {id:"INV-2024-003",date:"2024-12-05",customer:"Seoul Trading Co.",country:"South Korea",product:"Laptop Stand",qty:200,currency:"USD",total:4800,status:"in_progress",hsCode:"9403.10"},
  {id:"INV-2024-004",date:"2024-12-10",customer:"Singapore Imports Pte.",country:"Singapore",product:"Wireless Earbuds",qty:300,currency:"SGD",total:21000,status:"draft",hsCode:"8517.12"},
];

// ============================================================
// VALIDATION ENGINE
// ============================================================
function runValidation(invoice, packingItems) {
  const errors = [];
  const warnings = [];

  if (!invoice.hsCode) errors.push({field:"hsCode",msg:"HSコードが未入力です。通関に必須です。",risk:"HIGH"});
  if (!invoice.incoterms) errors.push({field:"incoterms",msg:"Incotermsが未選択です。",risk:"HIGH"});
  if (!invoice.countryOfOrigin) errors.push({field:"countryOfOrigin",msg:"原産国が未入力です。",risk:"HIGH"});
  if (!invoice.currency) errors.push({field:"currency",msg:"通貨が未選択です。",risk:"HIGH"});

  const invoiceQty = invoice.items?.reduce((s,i)=>s+(Number(i.quantity)||0),0)||0;
  const packingQty = packingItems?.reduce((s,i)=>s+(Number(i.quantity)||0),0)||0;
  if (invoiceQty>0 && packingQty>0 && invoiceQty!==packingQty) {
    errors.push({field:"quantity",msg:`数量不一致: Invoice ${invoiceQty}個 / Packing ${packingQty}個`,risk:"HIGH"});
  }

  packingItems?.forEach((item,idx)=>{
    if (!item.grossWeight||Number(item.grossWeight)===0) {
      errors.push({field:`grossWeight_${idx}`,msg:`カートン${item.cartonNo}の総重量が未入力です。`,risk:"HIGH"});
    }
    if (item.grossWeight && item.netWeight && Number(item.grossWeight)<Number(item.netWeight)) {
      errors.push({field:`weight_${idx}`,msg:`カートン${item.cartonNo}の総重量が正味重量より小さいです。`,risk:"MEDIUM"});
    }
    if (item.grossWeight && Number(item.grossWeight)>5000) {
      warnings.push({field:`weight_${idx}`,msg:`カートン${item.cartonNo}の重量が5000kgを超えています。確認してください。`,risk:"LOW"});
    }
  });

  if (invoice.date) {
    const d = new Date(invoice.date);
    if (isNaN(d.getTime())) errors.push({field:"date",msg:"日付フォーマットが無効です。",risk:"MEDIUM"});
    const today = new Date();
    const diff = (d-today)/(1000*60*60*24);
    if (diff>180) warnings.push({field:"date",msg:"出荷日が6か月以上先になっています。確認してください。",risk:"LOW"});
  }

  if (!invoice.shipper) warnings.push({field:"shipper",msg:"Shipper情報が未入力です。",risk:"LOW"});
  if (!invoice.consignee) warnings.push({field:"consignee",msg:"Consignee情報が未入力です。",risk:"LOW"});

  if (invoice.items?.length>0) {
    const currencies = new Set(invoice.items.map(i=>i.currency).filter(Boolean));
    if (currencies.size>1) {
      errors.push({field:"currency",msg:`複数の通貨が混在しています: ${[...currencies].join(", ")}`,risk:"MEDIUM"});
    }
  }

  return {errors, warnings, riskLevel: errors.some(e=>e.risk==="HIGH")?"HIGH":errors.length>0?"MEDIUM":warnings.length>0?"LOW":"CLEAR"};
}

// ============================================================
// CSS
// ============================================================
const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#F7F7F5;color:#1A1A1A;min-height:100vh}

:root{
  --bg:#F7F7F5;--surface:#FFFFFF;--border:#E5E3DE;--border-strong:#C8C5BE;
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
.logo-text{font-size:15px;font-weight:600;color:var(--text);letter-spacing:-.3px}
.logo-sub{font-size:11px;color:var(--text-muted);margin-top:2px}
.sidebar-nav{padding:12px 8px;flex:1}
.nav-section-label{font-size:10px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.8px;padding:8px 10px 4px}
.nav-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:var(--radius);cursor:pointer;font-size:13.5px;color:var(--text-muted);transition:all .15s;margin-bottom:1px;border:none;background:none;width:100%;text-align:left}
.nav-item:hover{background:#F0EEE9;color:var(--text)}
.nav-item.active{background:var(--blue-light);color:var(--blue);font-weight:500}
.nav-icon{font-size:14px;width:18px;text-align:center}
.nav-badge{margin-left:auto;background:var(--red);color:#fff;font-size:10px;font-weight:600;padding:2px 6px;border-radius:10px}

.topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:0 28px;height:56px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:5}
.topbar-title{font-size:16px;font-weight:600;color:var(--text)}
.topbar-actions{display:flex;gap:8px;align-items:center}

.content{padding:28px}

.step-bar{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xl);padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;gap:0}
.step-item{display:flex;align-items:center;flex:1}
.step-dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;transition:all .2s}
.step-dot.done{background:var(--green);color:#fff}
.step-dot.active{background:var(--blue);color:#fff;box-shadow:0 0 0 3px var(--blue-mid)}
.step-dot.pending{background:#F0EEE9;color:var(--text-muted)}
.step-label{font-size:11px;color:var(--text-muted);margin-top:4px;text-align:center}
.step-line{flex:1;height:2px;background:var(--border);margin:0 4px;margin-bottom:16px;transition:background .2s}
.step-line.done{background:var(--green)}
.step-content{display:flex;flex-direction:column;align-items:center;min-width:60px}

.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xl);padding:20px 24px;margin-bottom:16px;box-shadow:var(--shadow)}
.card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.card-title{font-size:14px;font-weight:600;color:var(--text)}
.card-subtitle{font-size:12px;color:var(--text-muted);margin-top:2px}

.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}

.field{display:flex;flex-direction:column;gap:5px}
.label{font-size:12px;font-weight:500;color:var(--text-muted);display:flex;align-items:center;gap:4px}
.required-dot{color:var(--red);font-size:14px;line-height:1}
.input,select,textarea{
  font-family:'DM Sans',sans-serif;font-size:13.5px;color:var(--text);
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:8px 11px;transition:all .15s;outline:none;width:100%
}
.input:hover,select:hover,textarea:hover{border-color:var(--border-strong)}
.input:focus,select:focus,textarea:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-light)}
.input.error,select.error{border-color:var(--red);background:var(--red-light)}
.input.error:focus,select.error:focus{box-shadow:0 0 0 3px var(--red-light)}
textarea{resize:vertical;min-height:70px}

.autocomplete-wrap{position:relative}
.autocomplete-list{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--radius-lg);box-shadow:var(--shadow-md);z-index:100;max-height:200px;overflow-y:auto}
.autocomplete-item{padding:8px 12px;font-size:13px;cursor:pointer;display:flex;align-items:flex-start;gap:8px}
.autocomplete-item:hover{background:var(--blue-light)}
.autocomplete-code{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--blue);font-weight:500;min-width:72px;flex-shrink:0;margin-top:1px}
.autocomplete-desc{font-size:12px;color:var(--text-muted);line-height:1.4}

.btn{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;padding:8px 16px;border-radius:var(--radius);border:1px solid transparent;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px}
.btn-primary{background:var(--blue);color:#fff;border-color:var(--blue)}
.btn-primary:hover{background:#1D4ED8}
.btn-secondary{background:var(--surface);color:var(--text);border-color:var(--border-strong)}
.btn-secondary:hover{background:#F0EEE9;border-color:var(--border-strong)}
.btn-danger{background:var(--red-light);color:var(--red);border-color:var(--red-mid)}
.btn-danger:hover{background:var(--red-mid)}
.btn-sm{padding:5px 11px;font-size:12px}
.btn-xs{padding:3px 8px;font-size:11px}
.btn-green{background:var(--green);color:#fff;border-color:var(--green)}
.btn-green:hover{background:#15803D}
.btn-amber{background:var(--amber);color:#fff;border-color:var(--amber)}
.btn-amber:hover{background:#B45309}

.validation-panel{border-radius:var(--radius-xl);padding:16px 20px;margin-bottom:16px}
.validation-panel.HIGH{background:#FFF5F5;border:1px solid var(--red-mid)}
.validation-panel.MEDIUM{background:var(--amber-light);border:1px solid var(--amber-mid)}
.validation-panel.LOW{background:#FEFCE8;border:1px solid #FEF08A}
.validation-panel.CLEAR{background:var(--green-light);border:1px solid var(--green-mid)}
.validation-title{font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;margin-bottom:10px}
.validation-item{font-size:12.5px;padding:5px 0;display:flex;align-items:flex-start;gap:6px;border-top:1px solid rgba(0,0,0,.06)}
.risk-HIGH{color:var(--red)}
.risk-MEDIUM{color:var(--amber)}
.risk-LOW{color:#65A30D}
.risk-badge{font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;flex-shrink:0;margin-top:1px}
.risk-badge.HIGH{background:var(--red-mid);color:var(--red)}
.risk-badge.MEDIUM{background:var(--amber-mid);color:var(--amber)}
.risk-badge.LOW{background:#D9F99D;color:#3F6212}

.items-table{width:100%;border-collapse:collapse}
.items-table th{font-size:11px;font-weight:600;color:var(--text-muted);text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);background:#FAFAF8}
.items-table td{padding:5px 6px;border-bottom:1px solid var(--border);vertical-align:middle}
.items-table tr:last-child td{border-bottom:none}
.items-table .input{border:1px solid transparent;background:transparent;padding:5px 8px}
.items-table .input:hover{border-color:var(--border);background:var(--surface)}
.items-table .input:focus{border-color:var(--blue);background:var(--surface)}

.total-row{display:flex;justify-content:flex-end;margin-top:12px;gap:24px;padding:12px 16px;background:#F7F7F5;border-radius:var(--radius-lg)}
.total-label{font-size:12px;color:var(--text-muted)}
.total-value{font-size:18px;font-weight:600;color:var(--text);font-feature-settings:"tnum"}

.history-item{padding:14px 16px;border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:8px;cursor:pointer;transition:all .15s}
.history-item:hover{border-color:var(--blue-mid);background:var(--blue-light)}
.history-meta{display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap}
.tag{font-size:11px;padding:2px 8px;border-radius:4px;font-weight:500}
.tag-blue{background:var(--blue-light);color:var(--blue)}
.tag-green{background:var(--green-light);color:var(--green)}
.tag-amber{background:var(--amber-light);color:var(--amber)}
.tag-gray{background:#F0EEE9;color:var(--text-muted)}
.tag-red{background:var(--red-light);color:var(--red)}
.tag-purple{background:var(--purple-light);color:var(--purple)}

.status-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px}
.status-completed{background:var(--green-mid);color:#14532D}
.status-shipped{background:var(--blue-mid);color:#1E3A8A}
.status-in_progress{background:var(--amber-mid);color:#78350F}
.status-draft{background:#F0EEE9;color:var(--text-muted)}

.tabs{display:flex;gap:2px;background:#F0EEE9;padding:3px;border-radius:var(--radius-lg);margin-bottom:20px}
.tab{padding:7px 16px;border-radius:var(--radius);font-size:13px;font-weight:500;cursor:pointer;color:var(--text-muted);transition:all .15s;border:none;background:none}
.tab.active{background:var(--surface);color:var(--text);box-shadow:var(--shadow)}

.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xl);padding:16px 20px}
.stat-label{font-size:11px;color:var(--text-muted);font-weight:500;margin-bottom:6px}
.stat-value{font-size:24px;font-weight:600;color:var(--text);font-feature-settings:"tnum"}
.stat-sub{font-size:12px;color:var(--text-muted);margin-top:4px}

.checklist-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px}
.checklist-item:last-child{border-bottom:none}
.check-icon{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}
.check-ok{background:var(--green-mid);color:var(--green)}
.check-fail{background:var(--red-mid);color:var(--red)}
.check-warn{background:var(--amber-mid);color:var(--amber)}

.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
.modal{background:var(--surface);border-radius:var(--radius-xl);padding:24px;width:100%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.15);max-height:80vh;overflow-y:auto}
.modal-title{font-size:16px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}

.pdf-preview{background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:32px;font-size:12px;line-height:1.6;color:#000;box-shadow:var(--shadow-md)}
.pdf-preview h1{font-size:22px;font-weight:700;letter-spacing:2px;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:16px}
.pdf-preview .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
.pdf-preview .meta-item{padding:6px 0;border-bottom:1px solid #EEE}
.pdf-preview .meta-key{font-size:9px;font-weight:600;text-transform:uppercase;color:#666;margin-bottom:2px}
.pdf-preview table{width:100%;border-collapse:collapse;margin-top:16px}
.pdf-preview th{background:#F5F5F5;padding:6px 8px;text-align:left;font-size:10px;font-weight:600;border:1px solid #DDD}
.pdf-preview td{padding:6px 8px;border:1px solid #DDD;font-size:11px}
.pdf-preview .total-section{margin-top:16px;text-align:right;border-top:2px solid #000;padding-top:12px}

@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.fade-in{animation:fadeIn .2s ease}

.empty-state{text-align:center;padding:48px 24px;color:var(--text-muted)}
.empty-icon{font-size:40px;margin-bottom:12px}
.empty-text{font-size:14px}

@media(max-width:900px){
  .sidebar{width:200px}
  .main{margin-left:200px}
  .grid-4{grid-template-columns:1fr 1fr}
  .grid-3{grid-template-columns:1fr 1fr}
}
`;

// ============================================================
// COMPONENTS
// ============================================================
function AutocompleteInput({value, onChange, suggestions, placeholder, className=""}) {
  const [open, setOpen] = useState(false);
  const filtered = suggestions?.filter(s=>
    (s.code||s).toLowerCase().includes(value?.toLowerCase()||"") ||
    (s.desc||"").toLowerCase().includes(value?.toLowerCase()||"")
  ).slice(0,8);

  return (
    <div className="autocomplete-wrap">
      <input className={`input ${className}`} value={value||""} placeholder={placeholder}
        onChange={e=>{onChange(e.target.value);setOpen(true)}}
        onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),150)}
      />
      {open && filtered?.length>0 && (
        <div className="autocomplete-list">
          {filtered.map((s,i)=>(
            <div key={i} className="autocomplete-item" onMouseDown={()=>{onChange(s.code||s);setOpen(false)}}>
              {s.code ? <>
                <span className="autocomplete-code">{s.code}</span>
                <span className="autocomplete-desc">{s.desc}</span>
              </> : <span>{s}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ValidationPanel({invoice, packingItems}) {
  const {errors, warnings, riskLevel} = useMemo(()=>runValidation(invoice, packingItems),[invoice, packingItems]);
  const icon = riskLevel==="HIGH"?"🚨":riskLevel==="MEDIUM"?"⚠️":riskLevel==="LOW"?"💛":"✅";
  const titleText = riskLevel==="HIGH"?"通関リスク: 重大なエラーがあります":
    riskLevel==="MEDIUM"?"確認が必要な項目があります":
    riskLevel==="LOW"?"軽微な警告があります":
    "すべての必須項目が入力されています";

  return (
    <div className={`validation-panel ${riskLevel}`}>
      <div className="validation-title">
        <span>{icon}</span>
        <span>{titleText}</span>
        {riskLevel!=="CLEAR"&&<span className={`risk-badge ${riskLevel}`}>{errors.length}エラー / {warnings.length}警告</span>}
      </div>
      {errors.map((e,i)=>(
        <div key={i} className="validation-item">
          <span className={`risk-badge ${e.risk}`}>{e.risk}</span>
          <span className="risk-HIGH">🔴 {e.msg}</span>
        </div>
      ))}
      {warnings.map((w,i)=>(
        <div key={i} className="validation-item">
          <span className={`risk-badge ${w.risk}`}>{w.risk}</span>
          <span className="risk-LOW">🟡 {w.msg}</span>
        </div>
      ))}
    </div>
  );
}

function StepBar({currentStep, setStep}) {
  return (
    <div className="step-bar">
      {STEPS.map((s,i)=>(
        <div key={s.id} className="step-item">
          <div className="step-content">
            <div
              className={`step-dot ${currentStep>s.id?"done":currentStep===s.id?"active":"pending"}`}
              style={{cursor:"pointer"}}
              onClick={()=>setStep(s.id)}
            >
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
function InvoiceForm({invoice, setInvoice, onNext}) {
  const addItem = () => setInvoice(v=>({...v, items:[...(v.items||[]),{id:Date.now(),productName:"",quantity:"",unitPrice:"",currency:v.currency||"USD",hsCode:""}]}));
  const updateItem = (id,field,val) => setInvoice(v=>({...v,items:v.items.map(it=>it.id===id?{...it,[field]:val}:it)}));
  const removeItem = id => setInvoice(v=>({...v,items:v.items.filter(it=>it.id!==id)}));
  const total = (invoice.items||[]).reduce((s,it)=>s+(Number(it.quantity||0)*Number(it.unitPrice||0)),0);
  const errFields = useMemo(()=>{const {errors}=runValidation(invoice,[]);return new Set(errors.map(e=>e.field));},[invoice]);

  return (
    <div className="fade-in">
      {/* Shipper / Consignee */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">📋 基本情報</div>
            <div className="card-subtitle">Invoice No・出荷者・荷受人を入力</div>
          </div>
        </div>
        <div className="grid-3" style={{marginBottom:16}}>
          <div className="field">
            <label className="label"><span className="required-dot">*</span>Invoice No</label>
            <input className={`input ${errFields.has("invoiceNo")?"error":""}`} value={invoice.invoiceNo||""} placeholder="INV-2024-001"
              onChange={e=>setInvoice(v=>({...v,invoiceNo:e.target.value}))} />
          </div>
          <div className="field">
            <label className="label"><span className="required-dot">*</span>Date</label>
            <input type="date" className={`input ${errFields.has("date")?"error":""}`} value={invoice.date||""}
              onChange={e=>setInvoice(v=>({...v,date:e.target.value}))} />
          </div>
          <div className="field">
            <label className="label"><span className="required-dot">*</span>Currency</label>
            <select className={`input ${errFields.has("currency")?"error":""}`} value={invoice.currency||""}
              onChange={e=>setInvoice(v=>({...v,currency:e.target.value}))}>
              <option value="">選択してください</option>
              {CURRENCIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2" style={{marginBottom:16}}>
          <div className="field">
            <label className="label"><span className="required-dot">*</span>Shipper</label>
            <textarea className={`input ${errFields.has("shipper")?"error":""}`} value={invoice.shipper||""} rows={3} placeholder="会社名&#10;住所&#10;国"
              onChange={e=>setInvoice(v=>({...v,shipper:e.target.value}))} />
          </div>
          <div className="field">
            <label className="label"><span className="required-dot">*</span>Consignee</label>
            <textarea className={`input ${errFields.has("consignee")?"error":""}`} value={invoice.consignee||""} rows={3} placeholder="会社名&#10;住所&#10;国"
              onChange={e=>setInvoice(v=>({...v,consignee:e.target.value}))} />
          </div>
        </div>
        <div className="field">
          <label className="label">Notify Party</label>
          <textarea className="input" value={invoice.notifyParty||""} rows={2} placeholder="通知先（L/C発行時など）"
            onChange={e=>setInvoice(v=>({...v,notifyParty:e.target.value}))} />
        </div>
      </div>

      {/* Trade Terms */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🚢 貿易条件</div>
        </div>
        <div className="grid-4">
          <div className="field">
            <label className="label"><span className="required-dot">*</span>Incoterms</label>
            <select className={`input ${errFields.has("incoterms")?"error":""}`} value={invoice.incoterms||""}
              onChange={e=>setInvoice(v=>({...v,incoterms:e.target.value}))}>
              <option value="">選択</option>
              {INCOTERMS.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Shipping Method</label>
            <select className="input" value={invoice.shippingMethod||""}
              onChange={e=>setInvoice(v=>({...v,shippingMethod:e.target.value}))}>
              <option value="">選択</option>
              {SHIPPING_METHODS.map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label"><span className="required-dot">*</span>Country of Origin</label>
            <AutocompleteInput value={invoice.countryOfOrigin||""} suggestions={COUNTRIES} placeholder="Japan"
              className={errFields.has("countryOfOrigin")?"error":""} onChange={v=>setInvoice(iv=>({...iv,countryOfOrigin:v}))} />
          </div>
          <div className="field">
            <label className="label">Port of Loading</label>
            <input className="input" value={invoice.portOfLoading||""} placeholder="JPTYO"
              onChange={e=>setInvoice(v=>({...v,portOfLoading:e.target.value}))} />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">📦 品目明細</div>
            <div className="card-subtitle">HSコードは必ず入力してください（通関必須）</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={addItem}>+ 品目追加</button>
        </div>

        {(!invoice.items||invoice.items.length===0) ? (
          <div className="empty-state"><div className="empty-icon">📦</div><div className="empty-text">品目を追加してください</div></div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table className="items-table">
              <thead>
                <tr>
                  <th style={{width:160}}>製品名 <span style={{color:"var(--red)"}}>*</span></th>
                  <th style={{width:80}}>数量 <span style={{color:"var(--red)"}}>*</span></th>
                  <th style={{width:90}}>単価</th>
                  <th style={{width:75}}>通貨</th>
                  <th style={{width:120}}>HSコード <span style={{color:"var(--red)"}}>*</span></th>
                  <th style={{width:80}}>小計</th>
                  <th style={{width:36}}></th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map(item=>(
                  <tr key={item.id}>
                    <td><input className="input" value={item.productName||""} placeholder="製品名" onChange={e=>updateItem(item.id,"productName",e.target.value)}/></td>
                    <td><input className="input" type="number" value={item.quantity||""} placeholder="0" onChange={e=>updateItem(item.id,"quantity",e.target.value)}/></td>
                    <td><input className="input" type="number" value={item.unitPrice||""} placeholder="0.00" onChange={e=>updateItem(item.id,"unitPrice",e.target.value)}/></td>
                    <td>
                      <select className="input" value={item.currency||invoice.currency||"USD"} onChange={e=>updateItem(item.id,"currency",e.target.value)}>
                        {CURRENCIES.map(c=><option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      <AutocompleteInput value={item.hsCode||""} suggestions={SAMPLE_HS_CODES}
                        className={!item.hsCode?"error":""} placeholder="0000.00"
                        onChange={v=>updateItem(item.id,"hsCode",v)} />
                    </td>
                    <td style={{fontWeight:500,fontSize:13,color:"var(--text)",textAlign:"right",paddingRight:8}}>
                      {((Number(item.quantity||0)*Number(item.unitPrice||0)).toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2}))}
                    </td>
                    <td><button className="btn btn-danger btn-xs" onClick={()=>removeItem(item.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(invoice.items?.length>0) && (
          <div className="total-row">
            <div>
              <div className="total-label">Total Amount</div>
              <div className="total-value">{invoice.currency||"USD"} {total.toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
            </div>
          </div>
        )}
      </div>

      {/* Remarks */}
      <div className="card">
        <div className="card-header"><div className="card-title">📝 備考</div></div>
        <div className="field">
          <textarea className="input" value={invoice.remarks||""} rows={3} placeholder="特記事項・通関上の注意事項など"
            onChange={e=>setInvoice(v=>({...v,remarks:e.target.value}))} />
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        <button className="btn btn-primary" onClick={onNext}>Packing List入力へ →</button>
      </div>
    </div>
  );
}

// ============================================================
// PACKING LIST FORM
// ============================================================
function PackingListForm({invoice, packingItems, setPackingItems, onNext, onBack}) {
  const addCarton = () => {
    const nextNo = (packingItems.length>0 ? Math.max(...packingItems.map(p=>Number(p.cartonNo)||0)) : 0) + 1;
    setPackingItems(v=>[...v,{id:Date.now(),cartonNo:nextNo,productName:invoice.items?.[0]?.productName||"",quantity:"",grossWeight:"",netWeight:"",dimensions:""}]);
  };
  const update = (id,field,val) => setPackingItems(v=>v.map(p=>p.id===id?{...p,[field]:val}:p));
  const remove = id => setPackingItems(v=>v.filter(p=>p.id!==id));

  const totalGross = packingItems.reduce((s,p)=>s+Number(p.grossWeight||0),0);
  const totalNet = packingItems.reduce((s,p)=>s+Number(p.netWeight||0),0);
  const totalQty = packingItems.reduce((s,p)=>s+Number(p.quantity||0),0);
  const invoiceQty = invoice.items?.reduce((s,i)=>s+Number(i.quantity||0),0)||0;
  const qtyMatch = totalQty===invoiceQty;

  return (
    <div className="fade-in">
      {/* Mismatch Warning */}
      {invoiceQty>0 && totalQty>0 && !qtyMatch && (
        <div className="validation-panel HIGH" style={{marginBottom:16}}>
          <div className="validation-title"><span>🚨</span><span>数量不一致エラー</span></div>
          <div className="validation-item">
            <span className="risk-badge HIGH">HIGH</span>
            <span className="risk-HIGH">Invoice合計: {invoiceQty}個 ≠ Packing合計: {totalQty}個（差分: {Math.abs(invoiceQty-totalQty)}個）</span>
          </div>
        </div>
      )}
      {invoiceQty>0 && totalQty>0 && qtyMatch && (
        <div className="validation-panel CLEAR" style={{marginBottom:16}}>
          <div className="validation-title"><span>✅</span><span>数量一致: Invoice / Packing List ともに {totalQty}個</span></div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">📦 梱包明細</div>
            <div className="card-subtitle">Invoiceから製品名を自動引用できます</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-secondary btn-sm" onClick={()=>{
              // Auto-fill from invoice items
              if (!invoice.items?.length) return;
              const auto = invoice.items.map((it,i)=>({id:Date.now()+i,cartonNo:i+1,productName:it.productName,quantity:it.quantity,grossWeight:"",netWeight:"",dimensions:""}));
              setPackingItems(auto);
            }}>Invoice から自動反映</button>
            <button className="btn btn-primary btn-sm" onClick={addCarton}>+ カートン追加</button>
          </div>
        </div>

        {packingItems.length===0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-text">「Invoice から自動反映」または「カートン追加」で開始</div>
          </div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table className="items-table">
              <thead>
                <tr>
                  <th style={{width:60}}>Carton No</th>
                  <th style={{width:150}}>製品名</th>
                  <th style={{width:70}}>数量 <span style={{color:"var(--red)"}}>*</span></th>
                  <th style={{width:90}}>総重量(kg) <span style={{color:"var(--red)"}}>*</span></th>
                  <th style={{width:90}}>正味重量(kg)</th>
                  <th style={{width:120}}>寸法(cm) L×W×H</th>
                  <th style={{width:36}}></th>
                </tr>
              </thead>
              <tbody>
                {packingItems.map(p=>(
                  <tr key={p.id}>
                    <td><input className="input" value={p.cartonNo} type="number" onChange={e=>update(p.id,"cartonNo",e.target.value)}/></td>
                    <td><input className="input" value={p.productName||""} placeholder="製品名" onChange={e=>update(p.id,"productName",e.target.value)}/></td>
                    <td><input className="input" type="number" value={p.quantity||""} placeholder="0"
                      className={`input ${invoiceQty>0&&!qtyMatch?"error":""}`}
                      onChange={e=>update(p.id,"quantity",e.target.value)}/></td>
                    <td><input className="input" type="number" value={p.grossWeight||""} placeholder="0.00"
                      className={`input ${!p.grossWeight?"error":""}`}
                      onChange={e=>update(p.id,"grossWeight",e.target.value)}/></td>
                    <td><input className="input" type="number" value={p.netWeight||""} placeholder="0.00" onChange={e=>update(p.id,"netWeight",e.target.value)}/></td>
                    <td><input className="input" value={p.dimensions||""} placeholder="60×40×30" onChange={e=>update(p.id,"dimensions",e.target.value)}/></td>
                    <td><button className="btn btn-danger btn-xs" onClick={()=>remove(p.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {packingItems.length>0 && (
          <div style={{display:"flex",gap:24,marginTop:12,padding:"12px 16px",background:"#F7F7F5",borderRadius:"var(--radius-lg)"}}>
            <div><div className="total-label">総カートン数</div><div className="total-value">{packingItems.length} ctns</div></div>
            <div><div className="total-label">合計数量</div><div className="total-value" style={{color:!qtyMatch&&invoiceQty>0?"var(--red)":undefined}}>{totalQty} pcs</div></div>
            <div><div className="total-label">総重量</div><div className="total-value">{totalGross.toFixed(2)} kg</div></div>
            <div><div className="total-label">正味重量</div><div className="total-value">{totalNet.toFixed(2)} kg</div></div>
          </div>
        )}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
        <button className="btn btn-secondary" onClick={onBack}>← Invoice に戻る</button>
        <button className="btn btn-primary" onClick={onNext}>内容確認へ →</button>
      </div>
    </div>
  );
}

// ============================================================
// REVIEW PAGE
// ============================================================
function ReviewPage({invoice, packingItems, onNext, onBack}) {
  const {errors, warnings, riskLevel} = useMemo(()=>runValidation(invoice, packingItems),[invoice, packingItems]);
  const total = (invoice.items||[]).reduce((s,it)=>s+(Number(it.quantity||0)*Number(it.unitPrice||0)),0);
  const checks = [
    {label:"Invoice No 入力済み",ok:!!invoice.invoiceNo},
    {label:"Shipper 入力済み",ok:!!invoice.shipper},
    {label:"Consignee 入力済み",ok:!!invoice.consignee},
    {label:"品目が1件以上ある",ok:(invoice.items?.length||0)>0},
    {label:"全品目にHSコード入力済み",ok:(invoice.items||[]).every(i=>i.hsCode)},
    {label:"Incoterms 選択済み",ok:!!invoice.incoterms},
    {label:"原産国 入力済み",ok:!!invoice.countryOfOrigin},
    {label:"Packing List 作成済み",ok:packingItems.length>0},
    {label:"Invoice/Packing 数量一致",ok:(()=>{const iq=(invoice.items||[]).reduce((s,i)=>s+Number(i.quantity||0),0);const pq=packingItems.reduce((s,p)=>s+Number(p.quantity||0),0);return iq===pq&&iq>0})()},
    {label:"重量入力済み",ok:packingItems.every(p=>p.grossWeight&&Number(p.grossWeight)>0)},
  ];
  const score = checks.filter(c=>c.ok).length;

  return (
    <div className="fade-in">
      <ValidationPanel invoice={invoice} packingItems={packingItems} />

      <div className="grid-2" style={{marginBottom:16}}>
        <div className="card">
          <div className="card-title" style={{marginBottom:14}}>📋 チェックリスト ({score}/{checks.length})</div>
          {checks.map((c,i)=>(
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
                ["Invoice No",invoice.invoiceNo||"—"],
                ["Date",invoice.date||"—"],
                ["Incoterms",invoice.incoterms||"—"],
                ["Country of Origin",invoice.countryOfOrigin||"—"],
                ["Shipping Method",invoice.shippingMethod||"—"],
                ["品目数",`${invoice.items?.length||0}件`],
                ["合計金額",`${invoice.currency||"USD"} ${total.toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2})}`],
                ["総カートン数",`${packingItems.length} ctns`],
                ["総重量",`${packingItems.reduce((s,p)=>s+Number(p.grossWeight||0),0).toFixed(2)} kg`],
              ].map(([k,v])=>(
                <tr key={k}><td style={{color:"var(--text-muted)",padding:"5px 0",borderBottom:"1px solid var(--border)"}}>{k}</td>
                <td style={{fontWeight:500,textAlign:"right",padding:"5px 0",borderBottom:"1px solid var(--border)"}}>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
        <button className="btn btn-secondary" onClick={onBack}>← Packing List に戻る</button>
        <button className="btn btn-primary" onClick={onNext} disabled={riskLevel==="HIGH"} style={{opacity:riskLevel==="HIGH"?.5:1}}>
          {riskLevel==="HIGH"?"⚠️ エラー解消後に進んでください":"PDF生成へ →"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// PDF PREVIEW & OUTPUT
// ============================================================
function OutputPage({invoice, packingItems, onBack}) {
  const [activeDoc, setActiveDoc] = useState("invoice");
  const total = (invoice.items||[]).reduce((s,it)=>s+(Number(it.quantity||0)*Number(it.unitPrice||0)),0);

  const handlePrint = () => {
    const content = document.getElementById("print-area");
    const w = window.open("","","width=900,height=1200");
    w.document.write(`<html><head><title>${activeDoc==="invoice"?"Invoice":"Packing List"}</title>
      <style>*{font-family:sans-serif;font-size:11px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px}th{background:#f5f5f5}</style>
      </head><body>${content.innerHTML}</body></html>`);
    w.document.close(); w.print();
  };

  return (
    <div className="fade-in">
      <div className="tabs">
        <button className={`tab ${activeDoc==="invoice"?"active":""}`} onClick={()=>setActiveDoc("invoice")}>📋 Invoice</button>
        <button className={`tab ${activeDoc==="packing"?"active":""}`} onClick={()=>setActiveDoc("packing")}>📦 Packing List</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">{activeDoc==="invoice"?"Invoice プレビュー":"Packing List プレビュー"}</div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>🖨️ PDF印刷</button>
            <button className="btn btn-green btn-sm" onClick={()=>alert("Excel出力機能: SheetJSで実装 (本番版)")}>📊 Excel出力</button>
          </div>
        </div>

        <div id="print-area" className="pdf-preview">
          {activeDoc==="invoice" ? (
            <>
              <h1>COMMERCIAL INVOICE</h1>
              <div className="meta-grid">
                <div className="meta-item"><div className="meta-key">Invoice No.</div><strong>{invoice.invoiceNo||"—"}</strong></div>
                <div className="meta-item"><div className="meta-key">Date</div>{invoice.date||"—"}</div>
                <div className="meta-item"><div className="meta-key">Incoterms</div>{invoice.incoterms||"—"}</div>
                <div className="meta-item"><div className="meta-key">Country of Origin</div>{invoice.countryOfOrigin||"—"}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:12}}>
                <div><div className="meta-key" style={{marginBottom:4}}>SHIPPER</div><div style={{whiteSpace:"pre-wrap",fontSize:11}}>{invoice.shipper||"—"}</div></div>
                <div><div className="meta-key" style={{marginBottom:4}}>CONSIGNEE</div><div style={{whiteSpace:"pre-wrap",fontSize:11}}>{invoice.consignee||"—"}</div></div>
              </div>
              <table>
                <thead><tr><th>Description of Goods</th><th>HS Code</th><th style={{textAlign:"right"}}>Qty</th><th style={{textAlign:"right"}}>Unit Price</th><th style={{textAlign:"right"}}>Amount</th></tr></thead>
                <tbody>
                  {(invoice.items||[]).map((it,i)=>(
                    <tr key={i}><td>{it.productName}</td><td style={{fontFamily:"monospace"}}>{it.hsCode}</td>
                    <td style={{textAlign:"right"}}>{it.quantity}</td>
                    <td style={{textAlign:"right"}}>{invoice.currency} {Number(it.unitPrice||0).toFixed(2)}</td>
                    <td style={{textAlign:"right"}}>{invoice.currency} {(Number(it.quantity||0)*Number(it.unitPrice||0)).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="total-section">
                <strong>TOTAL: {invoice.currency||"USD"} {total.toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong>
              </div>
              {invoice.remarks && <div style={{marginTop:16,fontSize:11}}><strong>Remarks:</strong> {invoice.remarks}</div>}
            </>
          ) : (
            <>
              <h1>PACKING LIST</h1>
              <div className="meta-grid">
                <div className="meta-item"><div className="meta-key">Invoice No.</div><strong>{invoice.invoiceNo||"—"}</strong></div>
                <div className="meta-item"><div className="meta-key">Date</div>{invoice.date||"—"}</div>
                <div className="meta-item"><div className="meta-key">Total Cartons</div>{packingItems.length} CTNS</div>
                <div className="meta-item"><div className="meta-key">Total Gross Weight</div>{packingItems.reduce((s,p)=>s+Number(p.grossWeight||0),0).toFixed(2)} kg</div>
              </div>
              <table>
                <thead><tr><th>Carton No</th><th>Description</th><th style={{textAlign:"right"}}>Qty</th><th style={{textAlign:"right"}}>G.W.(kg)</th><th style={{textAlign:"right"}}>N.W.(kg)</th><th>Dimensions(cm)</th></tr></thead>
                <tbody>
                  {packingItems.map((p,i)=>(
                    <tr key={i}><td>{p.cartonNo}</td><td>{p.productName}</td>
                    <td style={{textAlign:"right"}}>{p.quantity}</td>
                    <td style={{textAlign:"right"}}>{Number(p.grossWeight||0).toFixed(2)}</td>
                    <td style={{textAlign:"right"}}>{Number(p.netWeight||0).toFixed(2)}</td>
                    <td>{p.dimensions||"—"}</td></tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><th>TOTAL</th><th></th>
                  <th style={{textAlign:"right"}}>{packingItems.reduce((s,p)=>s+Number(p.quantity||0),0)}</th>
                  <th style={{textAlign:"right"}}>{packingItems.reduce((s,p)=>s+Number(p.grossWeight||0),0).toFixed(2)}</th>
                  <th style={{textAlign:"right"}}>{packingItems.reduce((s,p)=>s+Number(p.netWeight||0),0).toFixed(2)}</th>
                  <th></th></tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
        <button className="btn btn-secondary" onClick={onBack}>← 内容確認に戻る</button>
        <button className="btn btn-primary" onClick={()=>alert("メール送信: mailto://または外部メールAPI連携 (本番版)")}>📧 メール送付へ →</button>
      </div>
    </div>
  );
}

// ============================================================
// HISTORY PAGE
// ============================================================
function HistoryPage({onLoad}) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = SAMPLE_HISTORY.filter(h=>{
    const q = search.toLowerCase();
    const matchQ = !q || h.customer.toLowerCase().includes(q)||h.id.toLowerCase().includes(q)||h.country.toLowerCase().includes(q)||h.product.toLowerCase().includes(q);
    const matchS = filterStatus==="all"||h.status===filterStatus;
    return matchQ && matchS;
  });

  const statusLabel = {completed:"出荷完了",shipped:"輸送中",in_progress:"作業中",draft:"下書き"};

  return (
    <div className="fade-in">
      <div className="grid-4" style={{marginBottom:20}}>
        {[
          {label:"総案件数",value:SAMPLE_HISTORY.length,sub:"全期間"},
          {label:"今月出荷",value:2,sub:"件"},
          {label:"作業中",value:1,sub:"件"},
          {label:"下書き",value:1,sub:"件"},
        ].map((s,i)=>(
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">📚 過去案件一覧</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {["all","draft","in_progress","shipped","completed"].map(s=>(
              <button key={s} className={`btn btn-sm ${filterStatus===s?"btn-primary":"btn-secondary"}`} onClick={()=>setFilterStatus(s)}>
                {s==="all"?"全て":statusLabel[s]||s}
              </button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <input className="input" placeholder="🔍 顧客名・Invoice No・製品名・国で検索..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        {filtered.map(h=>(
          <div key={h.id} className="history-item" onClick={()=>onLoad(h)}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
              <strong style={{fontSize:14}}>{h.id}</strong>
              <span className={`status-badge status-${h.status}`}>● {statusLabel[h.status]}</span>
            </div>
            <div style={{fontSize:13,color:"var(--text-muted)",marginBottom:6}}>{h.customer} — {h.product}</div>
            <div className="history-meta">
              <span className="tag tag-blue">{h.country}</span>
              <span className="tag tag-gray">{h.date}</span>
              <span className="tag tag-green">{h.currency} {h.total.toLocaleString()}</span>
              <span className="tag tag-purple" style={{fontFamily:"monospace",fontSize:11}}>HS: {h.hsCode}</span>
            </div>
          </div>
        ))}
        {filtered.length===0 && <div className="empty-state"><div className="empty-icon">🔍</div><div className="empty-text">該当する案件が見つかりません</div></div>}
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
const INITIAL_INVOICE = {invoiceNo:"",date:new Date().toISOString().split("T")[0],shipper:"",consignee:"",notifyParty:"",currency:"USD",incoterms:"",countryOfOrigin:"Japan",shippingMethod:"",portOfLoading:"JPTYO",hsCode:"",remarks:"",items:[]};

export default function App() {
  const [page, setPage] = useState("new");
  const [step, setStep] = useState(1);
  const [invoice, setInvoice] = useState(INITIAL_INVOICE);
  const [packingItems, setPackingItems] = useState([]);

  const validationResult = useMemo(()=>runValidation(invoice, packingItems),[invoice, packingItems]);

  const reset = () => { setInvoice(INITIAL_INVOICE); setPackingItems([]); setStep(1); setPage("new"); };
  const loadHistory = (h) => {
    setInvoice({...INITIAL_INVOICE, invoiceNo:h.id, date:h.date, countryOfOrigin:h.country, currency:h.currency,
      items:[{id:Date.now(),productName:h.product,quantity:"",unitPrice:"",currency:h.currency,hsCode:h.hsCode}]});
    setPackingItems([]);
    setStep(1); setPage("new");
  };

  const navItems = [
    {id:"new",label:"新規作成",icon:"✏️"},
    {id:"history",label:"過去案件",icon:"📚",badge:SAMPLE_HISTORY.filter(h=>h.status==="in_progress").length||null},
    {id:"templates",label:"テンプレート",icon:"📋"},
    {id:"customers",label:"顧客マスタ",icon:"🏢"},
    {id:"products",label:"製品マスタ",icon:"🗂️"},
  ];

  const topbarTitle = page==="history"?"過去案件検索":
    page==="templates"?"テンプレート管理":
    page==="customers"?"顧客マスタ":
    page==="products"?"製品マスタ":
    "新規書類作成";

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-text">🚢 TradeDoc</div>
            <div className="logo-sub">貿易書類管理システム</div>
          </div>
          <nav className="sidebar-nav">
            <div className="nav-section-label">メニュー</div>
            {navItems.map(n=>(
              <button key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={()=>setPage(n.id)}>
                <span className="nav-icon">{n.icon}</span>
                {n.label}
                {n.badge?<span className="nav-badge">{n.badge}</span>:null}
              </button>
            ))}

            <div className="nav-section-label" style={{marginTop:16}}>最近の案件</div>
            {SAMPLE_HISTORY.slice(0,3).map(h=>(
              <button key={h.id} className="nav-item" onClick={()=>loadHistory(h)}>
                <span className="nav-icon">📄</span>
                <span style={{fontSize:12,truncate:true,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.id}</span>
              </button>
            ))}

            <div style={{marginTop:"auto",padding:"16px 8px 8px"}}>
              {validationResult.errors.length>0&&(
                <div style={{padding:"8px 12px",background:"var(--red-light)",borderRadius:"var(--radius)",fontSize:12,color:"var(--red)"}}>
                  ⚠️ {validationResult.errors.length}件のエラーがあります
                </div>
              )}
            </div>
          </nav>
        </aside>

        {/* Main */}
        <main className="main">
          <div className="topbar">
            <div className="topbar-title">{topbarTitle}</div>
            <div className="topbar-actions">
              {page==="new"&&<button className="btn btn-secondary btn-sm" onClick={reset}>🔄 リセット</button>}
              {page==="new"&&<button className="btn btn-primary btn-sm" onClick={()=>setPage("history")}>📚 過去案件を参照</button>}
            </div>
          </div>

          <div className="content">
            {page==="new" && (
              <>
                <StepBar currentStep={step} setStep={setStep} />

                {step===1 && <InvoiceForm invoice={invoice} setInvoice={setInvoice} onNext={()=>setStep(2)} />}
                {step===2 && <PackingListForm invoice={invoice} packingItems={packingItems} setPackingItems={setPackingItems} onNext={()=>setStep(3)} onBack={()=>setStep(1)} />}
                {step===3 && <ReviewPage invoice={invoice} packingItems={packingItems} onNext={()=>setStep(4)} onBack={()=>setStep(2)} />}
                {step>=4 && <OutputPage invoice={invoice} packingItems={packingItems} onBack={()=>setStep(3)} />}
              </>
            )}

            {page==="history" && <HistoryPage onLoad={loadHistory} />}

            {(page==="templates"||page==="customers"||page==="products") && (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-icon">{page==="templates"?"📋":page==="customers"?"🏢":"🗂️"}</div>
                  <div className="empty-text" style={{marginBottom:16}}>
                    {page==="templates"?"顧客別テンプレート管理":page==="customers"?"顧客マスタ管理":"製品マスタ管理"}
                  </div>
                  <div style={{fontSize:13,color:"var(--text-muted)",maxWidth:400,margin:"0 auto",lineHeight:1.7}}>
                    {page==="templates"&&"よく使うInvoice・Packing Listのテンプレートを登録して、次回から1クリックで呼び出せます。Supabase customers_templatesテーブルと連携します。"}
                    {page==="customers"&&"顧客情報（会社名・住所・国・担当者・デフォルト通貨・Incoterms等）を登録して、書類作成時に自動入力できます。Supabase customersテーブルと連携します。"}
                    {page==="products"&&"製品情報（製品名・HSコード・単位・デフォルト単価・重量・寸法等）を登録して、書類作成時に自動補完できます。Supabase productsテーブルと連携します。"}
                  </div>
                  <div style={{marginTop:20}}>
                    <button className="btn btn-primary" onClick={()=>setPage("new")}>← 書類作成に戻る</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
