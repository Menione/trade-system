"use client";

async function signIn(email:string,password:string){
  const res=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON_KEY},
    body:JSON.stringify({email,password})
  });
  const d=await res.json();
  if(!res.ok)throw new Error(d.error_description||"ログイン失敗");
  return d;
}

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function sb(path: string, options: any = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Prefer": (options.method === "POST" || options.method === "PATCH") ? "return=representation" : "",
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

async function signOut(token:string){
  await fetch(`${SUPABASE_URL}/auth/v1/logout`,{
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON_KEY,"Authorization":`Bearer ${token}`}
  });
}

async function getUser(token:string){
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`,{
    headers:{"apikey":SUPABASE_ANON_KEY,"Authorization":`Bearer ${token}`}
  });
  if(!res.ok) return null;
  return res.json();
}

// ── LoginPage ─────────────────────────────────────────────
function LoginPage({onLogin}:{onLogin:(token:string,user:any)=>void}){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  const handleLogin=async(e:any)=>{
    e.preventDefault();
    setError("");setLoading(true);
    try{
      const d=await signIn(email,password);
      localStorage.setItem("trade_token",d.access_token);
      onLogin(d.access_token,d.user);
    }catch(err:any){
      setError(err.message||"ログインに失敗しました");
    }finally{setLoading(false);}
  };

  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)"}}>
      <div style={{background:"#fff",borderRadius:16,padding:"48px 40px",width:400,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:8}}>🌏</div>
          <div style={{fontSize:22,fontWeight:800,color:"#1a1a2e",letterSpacing:1}}>TradeDoc</div>
          <div style={{fontSize:13,color:"#666",marginTop:4}}>貿易書類管理システム</div>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#444",marginBottom:6}}>メールアドレス</label>
          <input
            type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="email@example.com"
            style={{width:"100%",padding:"10px 12px",border:"1px solid #ddd",borderRadius:8,fontSize:14,outline:"none",boxSizing:"border-box" as any}}
          />
        </div>
        <div style={{marginBottom:24}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#444",marginBottom:6}}>パスワード</label>
          <input
            type="password" value={password} onChange={e=>setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e=>e.key==="Enter"&&handleLogin(e)}
            style={{width:"100%",padding:"10px 12px",border:"1px solid #ddd",borderRadius:8,fontSize:14,outline:"none",boxSizing:"border-box" as any}}
          />
        </div>
        {error&&<div style={{background:"#FEF2F2",color:"#DC2626",padding:"10px 12px",borderRadius:8,fontSize:13,marginBottom:16}}>❌ {error}</div>}
        <button
          onClick={handleLogin} disabled={loading||!email||!password}
          style={{width:"100%",padding:"12px",background:loading?"#94a3b8":"#1a1a2e",color:"#fff",border:"none",borderRadius:8,fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",transition:"background 0.2s"}}
        >
          {loading?"ログイン中...":"ログイン"}
        </button>
        <div style={{marginTop:24,padding:"16px",background:"#F8FAFC",borderRadius:8,fontSize:12,color:"#666"}}>
          <div style={{fontWeight:600,marginBottom:4}}>📋 ログインできない場合</div>
          <div>Supabase管理画面の「Authentication」→「Users」でユーザーを作成してください。</div>
        </div>
      </div>
    </div>
  );
}



const CURRENCIES = ["JPY","USD","EUR","GBP","SGD","HKD","AUD","CNY"];
const INCOTERMS = ["EXW","FCA","CPT","CIP","DAP","DPU","DDP","FAS","FOB","CFR","CIF"];
const SHIPPING_METHODS = ["FedEx","DHL","Net International","EMS","Other","Sea Freight","Air Freight"];
const COUNTRIES = ["Japan","United States","China","Germany","France","United Kingdom","South Korea","Taiwan","Singapore","Hong Kong","Australia","Canada","Thailand","Vietnam","India","Indonesia","Malaysia","Philippines","Bangladesh","Brazil","Mexico","Netherlands","Belgium","Italy","Spain","Sweden","Switzerland","Poland","Turkey","Saudi Arabia"];

const INIT_INVOICE: any = {
  invoiceType:"proforma", invoiceNo:"", date:new Date().toISOString().split("T")[0],
  poNumber:"", paymentDue:"", shipper:"", consignee:"", shipTo:"", notifyParty:"",
  currency:"JPY", incoterms:"", countryOfOrigin:"Japan", shippingMethod:"", portOfLoading:"",
  remarks:"", expiryDate:"", items:[], status:"draft", language:"ja",
  trackingNumber:"", paymentConfirmed:false, approvalStatus:"draft",
};

const INIT_ORG: any = {
  companyName:"", address:"", tel:"", email:"", website:"",
  bankName:"", bankBranch:"", bankAddress:"", accountType:"普通", accountNo:"", accountName:"", swiftCode:"",
  signerName:"", signerTitle:"", logoBase64:"", signatureBase64:"",
  shipLocations:[], // 出荷場所リスト [{name:"本社", address:"xxx"}]
};

function fmt(amount: number, currency: string) {
  const nd = ["JPY","KRW","TWD","VND","IDR"];
  return nd.includes(currency) ? Math.round(amount).toLocaleString("ja-JP") : amount.toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2});
}

// 賞味期限を YYYY-MM（年月のみ）にフォーマット
function fmtExpiry(val: string): string {
  if (!val) return "";
  // YYYY-MM-DD → YYYY-MM
  const m = val.match(/^(\d{4}[-/]\d{2})/);
  return m ? m[1].replace("/","-") : val;
}

function validate(invoice: any, packing: any[]) {
  const errors: any[] = [], warnings: any[] = [];
  if (!invoice.incoterms) errors.push({step:1,msg:"Incotermsが未選択です"});
  if (!invoice.countryOfOrigin) errors.push({step:1,msg:"原産国が未入力です"});
  if (!invoice.currency) errors.push({step:1,msg:"通貨が未選択です"});
  if ((invoice.items||[]).length===0) errors.push({step:1,msg:"品目が未登録です"});
  packing.forEach((c,i) => {
    if (!c.grossWeight||Number(c.grossWeight)===0) errors.push({step:2,msg:`カートン${c.cartonNo}の総重量が未入力`});
  });
  if (!invoice.shipper) warnings.push({step:1,msg:"Shipper情報が未入力です"});
  if (!invoice.consignee) warnings.push({step:1,msg:"Consignee情報が未入力です"});
  const rl = errors.some(e=>e.risk==="HIGH")||errors.length>0?"HIGH":warnings.length>0?"LOW":"CLEAR";
  return {errors,warnings,riskLevel:errors.length>0?"HIGH":warnings.length>0?"LOW":"CLEAR"};
}

const T: any = {
  ja: {
    newDoc:"新規書類作成", history:"保存済み案件", customers:"得意先マスタ",
    products:"製品マスタ", org:"組織設定", approval:"承認管理", countryDocs:"国別必要書類",
    invoiceType:"書類タイプ", basicInfo:"基本情報", tradeTerms:"貿易条件",
    items:"品目明細", remarks:"備考", shipper:"Shipper（出荷者）",
    consignee:"Consignee（荷受人・書類上の宛先）", shipTo:"Ship To（納品先・実際の届け先）",
    totalAmount:"合計金額", draft:"下書き保存", requestApproval:"承認依頼",
    convertToCommercial:"Commercial Invoiceに変換", proforma:"Proforma Invoice（見積）",
    commercial:"Commercial Invoice（通関）", packingList:"Packing List",
    productName:"製品名", qty:"数量", unitPrice:"単価", hsCode:"HSコード",
    subtotal:"小計", grossWeight:"総重量(kg)", netWeight:"正味重量(kg)", dimensions:"寸法(cm)",
    cartonNo:"Carton No", addCarton:"+ カートン追加", autoFill:"Invoiceから自動反映",
    mixed:"混載", expiryDate:"賞味期限/使用期限", trackingNo:"追跡番号",
    paymentConfirm:"入金確認", completed:"出荷完了", print:"PDF印刷",
    save:"保存", cancel:"キャンセル", edit:"編集", delete:"削除",
    addItem:"+ 品目追加", selectProduct:"製品マスタから選択",
  },
  en: {
    newDoc:"New Document", history:"Saved Records", customers:"Customer Master",
    products:"Product Master", org:"Organization Settings", approval:"Approval",countryDocs:"Country Documents",
    invoiceType:"Document Type", basicInfo:"Basic Information", tradeTerms:"Trade Terms",
    items:"Line Items", remarks:"Remarks", shipper:"Shipper",
    consignee:"Consignee", shipTo:"Ship To",
    totalAmount:"Total Amount", draft:"Save Draft", requestApproval:"Request Approval",
    convertToCommercial:"Convert to Commercial Invoice", proforma:"Proforma Invoice",
    commercial:"Commercial Invoice", packingList:"Packing List",
    productName:"Product Name", qty:"Qty", unitPrice:"Unit Price", hsCode:"HS Code",
    subtotal:"Subtotal", grossWeight:"G.W.(kg)", netWeight:"N.W.(kg)", dimensions:"Dimensions(cm)",
    cartonNo:"Carton No", addCarton:"+ Add Carton", autoFill:"Auto Fill from Invoice",
    mixed:"Mixed", expiryDate:"Expiry Date", trackingNo:"Tracking No",
    paymentConfirm:"Payment Confirmed", completed:"Shipment Completed", print:"Print PDF",
    save:"Save", cancel:"Cancel", edit:"Edit", delete:"Delete",
    addItem:"+ Add Item", selectProduct:"Select from Products",
  }
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#F7F7F5;color:#1A1A1A;min-height:100vh}
:root{
  --surface:#FFF;--border:#E5E3DE;--border-strong:#C8C5BE;
  --text:#1A1A1A;--text-muted:#6B6960;--text-light:#9B9890;
  --blue:#2563EB;--blue-light:#EFF6FF;--blue-mid:#BFDBFE;
  --green:#16A34A;--green-light:#F0FDF4;--green-mid:#BBF7D0;
  --red:#DC2626;--red-light:#FEF2F2;--red-mid:#FECACA;
  --amber:#D97706;--amber-light:#FFFBEB;--amber-mid:#FDE68A;
  --purple:#7C3AED;--purple-light:#F5F3FF;
  --radius:8px;--radius-lg:12px;--radius-xl:16px;
  --shadow:0 1px 3px rgba(0,0,0,.06);--shadow-md:0 4px 6px rgba(0,0,0,.07);
}
.app{display:flex;min-height:100vh}
.sidebar{width:240px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;height:100vh;overflow-y:auto;z-index:10}
.main{margin-left:240px;flex:1;min-height:100vh}
.sidebar-logo{padding:14px 16px 10px;border-bottom:1px solid var(--border)}
.logo-img{width:100%;max-height:52px;object-fit:contain;margin-bottom:6px;display:block}
.logo-text{font-size:14px;font-weight:600;color:var(--text)}
.logo-sub{font-size:11px;color:var(--text-muted);margin-top:1px}
.sidebar-nav{padding:10px 8px;flex:1}
.nav-label{font-size:10px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.8px;padding:6px 10px 3px}
.nav-item{display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:var(--radius);cursor:pointer;font-size:13px;color:var(--text-muted);transition:all .15s;margin-bottom:1px;border:none;background:none;width:100%;text-align:left}
.nav-item:hover{background:#F0EEE9;color:var(--text)}
.nav-item.active{background:var(--blue-light);color:var(--blue);font-weight:500}
.nav-icon{font-size:13px;width:18px;text-align:center;flex-shrink:0}
.error-panel{margin:6px 8px;padding:8px 12px;background:var(--red-light);border:1px solid var(--red-mid);border-radius:var(--radius-lg)}
.error-panel-title{font-size:11px;font-weight:600;color:var(--red);margin-bottom:4px}
.error-panel-item{font-size:11px;color:var(--red);padding:2px 0;cursor:pointer;display:flex;align-items:center;gap:4px;text-decoration:underline}
.topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:0 24px;height:52px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:5}
.topbar-title{font-size:15px;font-weight:600}
.topbar-actions{display:flex;gap:6px;align-items:center}
.content{padding:24px}
.step-bar{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xl);padding:14px 18px;margin-bottom:20px;display:flex;align-items:center}
.step-item{display:flex;align-items:center;flex:1}
.step-dot{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex-shrink:0;cursor:pointer}
.step-dot.done{background:var(--green);color:#fff}
.step-dot.active{background:var(--blue);color:#fff;box-shadow:0 0 0 3px var(--blue-mid)}
.step-dot.pending{background:#F0EEE9;color:var(--text-muted)}
.step-label{font-size:10px;color:var(--text-muted);margin-top:3px;text-align:center}
.step-line{flex:1;height:2px;background:var(--border);margin:0 4px;margin-bottom:14px}
.step-line.done{background:var(--green)}
.step-content{display:flex;flex-direction:column;align-items:center;min-width:56px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xl);padding:18px 22px;margin-bottom:14px;box-shadow:var(--shadow)}
.card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.card-title{font-size:14px;font-weight:600}
.card-subtitle{font-size:12px;color:var(--text-muted);margin-top:2px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.field{display:flex;flex-direction:column;gap:4px}
.label{font-size:12px;font-weight:500;color:var(--text-muted);display:flex;align-items:center;gap:3px}
.req{color:var(--red);font-size:13px}
.input,select,textarea{font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:7px 10px;transition:all .15s;outline:none;width:100%}
.input:focus,select:focus,textarea:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-light)}
.input.error{border-color:var(--red);background:var(--red-light)}
textarea{resize:vertical;min-height:64px}
.autocomplete-wrap{position:relative}
.autocomplete-list{position:absolute;top:calc(100% + 3px);left:0;right:0;background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--radius-lg);box-shadow:var(--shadow-md);z-index:200;max-height:180px;overflow-y:auto}
.autocomplete-item{padding:7px 12px;font-size:12px;cursor:pointer;display:flex;align-items:flex-start;gap:8px}
.autocomplete-item:hover{background:var(--blue-light)}
.ac-code{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--blue);font-weight:500;min-width:68px;flex-shrink:0}
.ac-desc{font-size:11px;color:var(--text-muted)}
.btn{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;padding:7px 14px;border-radius:var(--radius);border:1px solid transparent;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:5px}
.btn-primary{background:var(--blue);color:#fff}
.btn-primary:hover{background:#1D4ED8}
.btn-primary:disabled{opacity:.5;cursor:not-allowed}
.btn-secondary{background:var(--surface);color:var(--text);border-color:var(--border-strong)}
.btn-secondary:hover{background:#F0EEE9}
.btn-danger{background:var(--red-light);color:var(--red);border-color:var(--red-mid)}
.btn-danger:hover{background:var(--red-mid)}
.btn-green{background:var(--green);color:#fff}
.btn-green:hover{background:#15803D}
.btn-amber{background:var(--amber);color:#fff}
.btn-amber:hover{background:#B45309}
.btn-purple{background:var(--purple);color:#fff}
.btn-sm{padding:4px 10px;font-size:12px}
.btn-xs{padding:2px 7px;font-size:11px}
.validation-panel{border-radius:var(--radius-xl);padding:14px 18px;margin-bottom:14px}
.validation-panel.HIGH{background:#FFF5F5;border:1px solid var(--red-mid)}
.validation-panel.LOW{background:#FEFCE8;border:1px solid #FEF08A}
.validation-panel.CLEAR{background:var(--green-light);border:1px solid var(--green-mid)}
.v-title{font-size:13px;font-weight:600;display:flex;align-items:center;gap:7px;margin-bottom:8px}
.v-item{font-size:12px;padding:4px 0;display:flex;align-items:flex-start;gap:5px;border-top:1px solid rgba(0,0,0,.06);cursor:pointer}
.v-item:hover{opacity:.8}
.risk-badge{font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;flex-shrink:0}
.risk-badge.HIGH{background:var(--red-mid);color:var(--red)}
.risk-badge.LOW{background:#D9F99D;color:#3F6212}
.items-table{width:100%;border-collapse:collapse}
.items-table th{font-size:11px;font-weight:600;color:var(--text-muted);text-align:left;padding:5px 8px;border-bottom:2px solid var(--border);background:#FAFAF8;white-space:nowrap}
.items-table td{padding:4px 5px;border-bottom:1px solid var(--border);vertical-align:middle}
.items-table .input{border:1px solid transparent;background:transparent;padding:4px 7px;font-size:12px}
.items-table .input:hover{border-color:var(--border);background:var(--surface)}
.items-table .input:focus{border-color:var(--blue);background:var(--surface)}
.total-row{display:flex;justify-content:flex-end;margin-top:10px;gap:20px;padding:10px 14px;background:#F7F7F5;border-radius:var(--radius-lg)}
.total-label{font-size:11px;color:var(--text-muted)}
.total-value{font-size:17px;font-weight:600}
.history-item{padding:12px 14px;border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:7px;transition:all .15s}
.history-item:hover{border-color:var(--blue-mid);background:var(--blue-light)}
.history-meta{display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap}
.tag{font-size:11px;padding:2px 7px;border-radius:4px;font-weight:500}
.tag-blue{background:var(--blue-light);color:var(--blue)}
.tag-green{background:var(--green-light);color:var(--green)}
.tag-amber{background:var(--amber-light);color:var(--amber)}
.tag-gray{background:#F0EEE9;color:var(--text-muted)}
.tag-purple{background:var(--purple-light);color:var(--purple)}
.tag-red{background:var(--red-light);color:var(--red)}
.status-badge{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px}
.status-draft,.status-pending_approval{background:#F0EEE9;color:var(--text-muted)}
.status-approved{background:var(--green-mid);color:#14532D}
.status-rejected{background:var(--red-mid);color:var(--red)}
.status-in_progress{background:var(--amber-mid);color:#78350F}
.status-completed{background:var(--green-mid);color:#14532D}
.tabs{display:flex;gap:2px;background:#F0EEE9;padding:3px;border-radius:var(--radius-lg);margin-bottom:18px}
.tab{padding:6px 14px;border-radius:var(--radius);font-size:13px;font-weight:500;cursor:pointer;color:var(--text-muted);border:none;background:none}
.tab.active{background:var(--surface);color:var(--text);box-shadow:var(--shadow)}
.checklist-item{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px}
.checklist-item:last-child{border-bottom:none}
.check-icon{width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0}
.check-ok{background:var(--green-mid);color:var(--green)}
.check-fail{background:var(--red-mid);color:var(--red)}
.check-todo{background:#F0EEE9;color:var(--text-muted)}
.carton-block{border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:10px;overflow:hidden}
.carton-header{background:#FAFAF8;padding:9px 13px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:7px}
.carton-lines{padding:7px 13px 11px}
.carton-fraction{background:var(--amber-light);border:1px solid var(--amber-mid)}
.org-section-title{font-size:13px;font-weight:600;color:var(--blue);border-left:3px solid var(--blue);padding-left:9px;margin-bottom:12px;margin-top:20px}
.upload-area{border:2px dashed var(--border-strong);border-radius:var(--radius-lg);padding:18px;text-align:center;cursor:pointer;transition:all .15s}
.upload-area:hover{border-color:var(--blue);background:var(--blue-light)}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
.modal{background:var(--surface);border-radius:var(--radius-xl);padding:22px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)}
.modal-title{font-size:15px;font-weight:600;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between}
.spinner{display:inline-block;width:15px;height:15px;border:2px solid var(--blue-mid);border-top-color:var(--blue);border-radius:50%;animation:spin .6s linear infinite}
.toast{position:fixed;bottom:20px;right:20px;background:#1A1A1A;color:#fff;padding:10px 18px;border-radius:var(--radius-lg);font-size:13px;z-index:9999;box-shadow:var(--shadow-md);animation:fadeIn .2s ease}
.empty-state{text-align:center;padding:40px 20px;color:var(--text-muted)}
.empty-icon{font-size:36px;margin-bottom:8px}
.saved-banner{background:var(--green-light);border:1px solid var(--green-mid);border-radius:var(--radius);padding:10px 16px;margin-bottom:14px;font-size:13px;color:var(--green);}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.fade-in{animation:fadeIn .2s ease}
/* PDF print styles */
@media print{
  .sidebar,.topbar,.no-print,.step-bar{display:none!important}
  .main{margin-left:0!important}
  .content{padding:0!important}
  body{background:#fff}
  .pdf-page{page-break-after:always}
  .pdf-page:last-child{page-break-after:avoid}
  tr{page-break-inside:avoid}
  thead{display:table-header-group}
  tfoot{display:table-footer-group}
}
`;

// ============================================================
// SUB COMPONENTS
// ============================================================
function Toast({msg,onClose}:any){
  useEffect(()=>{const t=setTimeout(onClose,3000);return()=>clearTimeout(t);},[onClose]);
  return <div className="toast">{msg}</div>;
}

function AcInput({value,onChange,suggestions,placeholder,className="",textOnly}:any){
  const [open,setOpen]=useState(false);
  const filtered=(suggestions||[]).filter((s:any)=>{
    const v=(value||"").toLowerCase();
    if(!v)return true;
    if(typeof s==="string")return s.toLowerCase().includes(v);
    return (s.code||"").toLowerCase().includes(v)||(s.desc||"").toLowerCase().includes(v);
  }).slice(0,10);
  return(
    <div className="autocomplete-wrap">
      <input className={`input ${className}`} value={value||""} placeholder={placeholder}
        onChange={(e:any)=>{onChange(e.target.value);setOpen(true);}}
        onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),150)}/>
      {open&&filtered.length>0&&(
        <div className="autocomplete-list">
          {filtered.map((s:any,i:number)=>(
            <div key={i} className="autocomplete-item"
              onMouseDown={()=>{onChange(typeof s==="string"?s:s.code);setOpen(false);}}>
              {typeof s==="string"?<span>{s}</span>:<><span className="ac-code">{s.code}</span><span className="ac-desc">{s.desc}</span></>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImgUpload({label,value,onChange,hint}:any){
  const ref=useRef<any>(null);
  const handle=(e:any)=>{
    const f=e.target.files?.[0];
    if(!f)return;
    const r=new FileReader();
    r.onload=(ev)=>onChange(ev.target?.result as string);
    r.readAsDataURL(f);
  };
  return(
    <div className="field">
      <label className="label">{label}</label>
      <div className="upload-area" onClick={()=>ref.current?.click()}>
        {value?(<div><img src={value} alt="preview" style={{maxHeight:72,maxWidth:"100%",objectFit:"contain",marginBottom:6}}/><div style={{fontSize:11,color:"var(--text-muted)"}}>クリックして変更</div></div>)
        :(<div><div style={{fontSize:22,marginBottom:6}}>📁</div><div style={{fontSize:12,color:"var(--text-muted)"}}>クリックしてアップロード</div>{hint&&<div style={{fontSize:11,color:"var(--text-light)",marginTop:3}}>{hint}</div>}</div>)}
        <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={handle}/>
      </div>
      {value&&<button className="btn btn-danger btn-xs" style={{alignSelf:"flex-start",marginTop:3}} onClick={()=>onChange("")}>削除</button>}
    </div>
  );
}

function StepBar({step,setStep,lang,invoiceType,approvalStatus}:any){
  // 統合7ステップワークフロー
  // ① Proforma作成・保存
  // ② Invoice作成・編集（金額調整可）
  // ③ Commercial Invoice作成・編集（通関用）
  // ④ Packing List作成・編集
  // ⑤ PDF出力（4タブ）
  // ⑥ 承認申請→承認
  // ⑦ 印刷・送付・出荷管理
  const isProforma=invoiceType==="proforma";

  const labels=isProforma
    ?["①Proforma作成","②承認申請"]
    :["①Proforma引用","②Invoice編集","③Commercial編集","④Packing List","⑤PDF出力","⑥承認","⑦出荷管理"];
  const icons=isProforma
    ?["📋","📨"]
    :["📋","📄","🔄","📦","🖨️","✅","🚢"];
  const total=labels.length;

  return(
    <div className="step-bar" style={{overflowX:"auto"}}>
      <div style={{display:"flex",alignItems:"center",minWidth:isProforma?240:700,flex:1}}>
      {labels.map((label,i)=>{
        const s=i+1;
        let dotClass="pending";
        if(step>s)dotClass="done";
        else if(step===s)dotClass="active";
        // ⑥承認はapprovalStatusに応じて色変え
        if(!isProforma&&s===6){
          if(approvalStatus==="approved")dotClass=step>=6?"done":"active";
          else if(approvalStatus==="pending_approval")dotClass="active";
        }
        return(
          <div key={s} className="step-item" style={{flex:1}}>
            <div className="step-content">
              <div className={`step-dot ${dotClass}`} onClick={()=>!isProforma&&setStep(s)} style={{cursor:isProforma?"default":"pointer",fontSize:10,width:28,height:28}}>
                {step>s?"✓":icons[i]}
              </div>
              <div className="step-label" style={{fontSize:9,whiteSpace:"nowrap"}}>{label}</div>
            </div>
            {i<total-1&&<div className={`step-line ${step>s?"done":""}`}/>}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function ValidationPanel({invoice,packing,setStep}:any){
  const {errors,warnings,riskLevel}=useMemo(()=>validate(invoice,packing),[invoice,packing]);
  const icon=riskLevel==="HIGH"?"🚨":riskLevel==="LOW"?"💛":"✅";
  const title=riskLevel==="HIGH"?"通関リスク: エラーがあります":riskLevel==="LOW"?"警告があります":"すべてOKです";
  return(
    <div className={`validation-panel ${riskLevel}`}>
      <div className="v-title"><span>{icon}</span><span>{title}</span>
        {riskLevel!=="CLEAR"&&<span className={`risk-badge ${riskLevel}`}>{errors.length}件</span>}
      </div>
      {errors.map((e:any,i:number)=>(
        <div key={i} className="v-item" onClick={()=>setStep&&setStep(e.step||1)}>
          <span className="risk-badge HIGH">HIGH</span>
          <span style={{color:"var(--red)"}}>🔴 {e.msg} →クリックでジャンプ</span>
        </div>
      ))}
      {warnings.map((w:any,i:number)=>(
        <div key={i} className="v-item" onClick={()=>setStep&&setStep(w.step||1)}>
          <span className="risk-badge LOW">LOW</span>
          <span style={{color:"#65A30D"}}>🟡 {w.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// INVOICE FORM
// ============================================================
function InvoiceForm({invoice,setInvoice,onNext,customers,products,org,lang}:any){
  const t=T[lang||"ja"];
  const addItem=()=>setInvoice((v:any)=>({...v,items:[...(v.items||[]),{id:Date.now(),productName:"",quantity:"",unitPrice:"",currency:v.currency||"JPY",hsCode:"",countryOfOrigin:"",expiryDate:""}]}));
  const upd=(id:number,f:string,val:any)=>setInvoice((v:any)=>({...v,items:v.items.map((it:any)=>it.id===id?{...it,[f]:val}:it)}));
  const del=(id:number)=>setInvoice((v:any)=>({...v,items:v.items.filter((it:any)=>it.id!==id)}));
  const total=(invoice.items||[]).reduce((s:number,it:any)=>s+(Number(it.quantity||0)*Number(it.unitPrice||0)),0);
  const cur=invoice.currency||"JPY";

  const applyCustomer=(c:any)=>{
    setInvoice((v:any)=>{
      // 特別価格を既存品目に反映
      const specialPrices:any[]=(c.special_prices||[]);
      const updatedItems=(v.items||[]).map((it:any)=>{
        if(!it.productName)return it;
        const sp=specialPrices.find((s:any)=>s.productName&&it.productName&&s.productName.trim()===it.productName.trim());
        return sp?{...it,unitPrice:sp.unitPrice,currency:sp.currency||c.currency||it.currency}:it;
      });
      return{...v,
        consignee:[c.name,c.address,c.country].filter(Boolean).join("\n"),
        shipTo:c.consignee_name?[c.consignee_name,c.consignee_address].filter(Boolean).join("\n"):v.shipTo,
        currency:c.currency||v.currency,
        incoterms:c.incoterms||v.incoterms,
        remarks:c.remarks?((v.remarks?v.remarks+"\n":"")+c.remarks):v.remarks,
        items:updatedItems,
        _selectedCustomer:c,
      };
    });
  };

  const applyShipTo=(c:any)=>{
    setInvoice((v:any)=>({...v,
      shipTo:[c.consignee_name||c.name,c.consignee_address||c.address,c.country].filter(Boolean).join("\n"),
    }));
  };

  const applyProduct=(p:any,itemId:number)=>{
    // 選択中の得意先に特別価格があれば優先
    const customer=invoice._selectedCustomer;
    const sp=(customer?.special_prices||[]).find((s:any)=>s.productName&&s.productName.trim()===p.name.trim());
    upd(itemId,"productName",p.name);
    upd(itemId,"hsCode",p.hs_code||"");
    upd(itemId,"unitPrice",sp?sp.unitPrice:p.unit_price||"");
    upd(itemId,"currency",sp?sp.currency||cur:p.currency||cur);
    upd(itemId,"countryOfOrigin",p.country_of_origin||invoice.countryOfOrigin||"");
  };

  return(
    <div className="fade-in">
      {/* 書類タイプ */}
      <div className="card">
        <div className="card-header"><div className="card-title">{t.invoiceType}</div>
          <select className="input" style={{width:120}} value={lang} onChange={(e:any)=>setInvoice((v:any)=>({...v,language:e.target.value}))}>
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          {[{v:"proforma",label:t.proforma},{v:"commercial",label:t.commercial}].map(tp=>(
            <button key={tp.v} className={`btn ${invoice.invoiceType===tp.v?"btn-primary":"btn-secondary"}`}
              onClick={()=>setInvoice((v:any)=>({...v,invoiceType:tp.v}))}>
              {tp.label}
            </button>
          ))}
        </div>
        {invoice.invoiceType==="proforma"&&(
          <div style={{fontSize:12,color:"var(--amber)",padding:"6px 10px",background:"var(--amber-light)",borderRadius:"var(--radius)"}}>
            ⚠️ まずProforma Invoiceを保存・承認後、Commercial Invoiceに変換してください
          </div>
        )}
        {invoice.approvalStatus==="approved"&&invoice.invoiceType==="proforma"&&(
          <button className="btn btn-green btn-sm" style={{marginTop:8}}
            onClick={()=>setInvoice((v:any)=>({...v,invoiceType:"commercial"}))}>
            ✅ {t.convertToCommercial}
          </button>
        )}
      </div>

      {/* 基本情報 */}
      <div className="card">
        <div className="card-header"><div><div className="card-title">{t.basicInfo}</div></div></div>
        <div className="grid-3" style={{marginBottom:13}}>
          <div className="field"><label className="label"><span className="req">*</span>Invoice No</label>
            <input className="input" value={invoice.invoiceNo||""} placeholder="INV-2024-001"
              onChange={(e:any)=>setInvoice((v:any)=>({...v,invoiceNo:e.target.value}))}/></div>
          <div className="field"><label className="label"><span className="req">*</span>{lang==="en"?"Date":"作成日付"}</label>
            <input type="date" className="input" value={invoice.date||""}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,date:e.target.value}))}/></div>
          <div className="field"><label className="label"><span className="req">*</span>Currency</label>
            <select className="input" value={invoice.currency||""}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,currency:e.target.value}))}>
              <option value="">{lang==="en"?"Select":"選択してください"}</option>
              {CURRENCIES.map((c:string)=><option key={c}>{c}</option>)}
            </select></div>
        </div>
        <div className="grid-2" style={{marginBottom:13}}>
          <div className="field"><label className="label">P.O. Number</label>
            <input className="input" value={invoice.poNumber||""} placeholder="PO-2024-001"
              onChange={(e:any)=>setInvoice((v:any)=>({...v,poNumber:e.target.value}))}/></div>
          <div className="field"><label className="label">Payment Due</label>
            <input type="date" className="input" value={invoice.paymentDue||""}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,paymentDue:e.target.value}))}/></div>
        </div>
        <div className="field" style={{marginBottom:13}}>
          <label className="label"><span className="req">*</span>{t.shipper}</label>
          <textarea className="input" value={invoice.shipper||""} rows={3} placeholder={lang==="en"?"Company\nAddress\nCountry":"会社名\n住所\n国"}
            onChange={(e:any)=>setInvoice((v:any)=>({...v,shipper:e.target.value}))}/>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
            {org?.companyName&&(
              <button className="btn btn-secondary btn-xs"
                onClick={()=>setInvoice((v:any)=>({...v,shipper:[org.companyName,org.address,org.tel?"Tel: "+org.tel:""].filter(Boolean).join("\n")}))}>
                ⚙️ {org.companyName}
              </button>
            )}
            {(org?.shipLocations||[]).map((loc:any,i:number)=>(
              <button key={i} className="btn btn-secondary btn-xs"
                onClick={()=>setInvoice((v:any)=>({...v,shipper:[org.companyName,loc.address,loc.tel?"Tel: "+loc.tel:""].filter(Boolean).join("\n")}))}>
                📍 {loc.name}
              </button>
            ))}
          </div>
        </div>
        {customers.length>0&&(
          <div style={{marginBottom:12,padding:"10px 14px",background:"var(--blue-light)",borderRadius:"var(--radius-lg)"}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--blue)",marginBottom:6}}>{lang==="en"?"Auto-fill from Customer":"得意先から自動入力"}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {customers.map((c:any)=>(
                <button key={c.id} className="btn btn-secondary btn-xs" onClick={()=>applyCustomer(c)}>{c.name}</button>
              ))}
            </div>
          </div>
        )}
        <div className="grid-2" style={{marginBottom:8}}>
          <div className="field">
            <label className="label"><span className="req">*</span>{t.consignee}</label>
            <textarea className="input" value={invoice.consignee||""} rows={3}
              placeholder={lang==="en"?"Company\nAddress\nCountry":"会社名\n住所\n国"}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,consignee:e.target.value}))}/>
          </div>
          <div className="field">
            <label className="label">{t.shipTo}</label>
            <textarea className="input" value={invoice.shipTo||""} rows={3}
              placeholder={lang==="en"?"Leave blank if same as Consignee":"Consigneeと異なる場合のみ入力"}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,shipTo:e.target.value}))}/>
            {customers.length>0&&(
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
                {customers.map((c:any)=>(
                  <button key={c.id} className="btn btn-secondary btn-xs" onClick={()=>applyShipTo(c)}>
                    {c.name} → Ship To
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="field">
          <label className="label">Notify Party</label>
          <textarea className="input" value={invoice.notifyParty||""} rows={2}
            onChange={(e:any)=>setInvoice((v:any)=>({...v,notifyParty:e.target.value}))}/>
        </div>
      </div>

      {/* 貿易条件 */}
      <div className="card">
        <div className="card-header"><div className="card-title">{t.tradeTerms}</div></div>
        <div className="grid-4">
          <div className="field"><label className="label"><span className="req">*</span>Incoterms</label>
            <select className="input" value={invoice.incoterms||""}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,incoterms:e.target.value}))}>
              <option value="">{lang==="en"?"Select":"選択"}</option>
              {INCOTERMS.map((t:string)=><option key={t}>{t}</option>)}
            </select></div>
          <div className="field"><label className="label">Shipping Method</label>
            <select className="input" value={invoice.shippingMethod||""}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,shippingMethod:e.target.value}))}>
              <option value="">{lang==="en"?"Select":"選択"}</option>
              {SHIPPING_METHODS.map((m:string)=><option key={m}>{m}</option>)}
            </select></div>
          <div className="field"><label className="label"><span className="req">*</span>Country of Origin</label>
            <AcInput value={invoice.countryOfOrigin||""} suggestions={COUNTRIES} placeholder="Japan"
              onChange={(val:string)=>setInvoice((v:any)=>({...v,countryOfOrigin:val}))}/></div>
          <div className="field"><label className="label">Port of Loading</label>
            <input className="input" value={invoice.portOfLoading||""} placeholder="JPKIX"
              onChange={(e:any)=>setInvoice((v:any)=>({...v,portOfLoading:e.target.value}))}/></div>
        </div>
      </div>

      {/* 品目明細 */}
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">{t.items}</div><div className="card-subtitle">HSコードは任意です</div></div>
          <button className="btn btn-primary btn-sm" onClick={addItem}>{t.addItem}</button>
        </div>
        {(!invoice.items||invoice.items.length===0)?(
          <div className="empty-state"><div className="empty-icon">📦</div><div style={{fontSize:13}}>{t.addItem}</div></div>
        ):(
          <div style={{overflowX:"auto"}}>
            <table className="items-table">
              <thead><tr>
                <th style={{width:110}}>{t.selectProduct}</th>
                <th style={{width:150}}>{t.productName}</th>
                <th style={{width:65}}>{t.qty}</th>
                <th style={{width:85}}>{t.unitPrice}</th>
                <th style={{width:60}}>通貨</th>
                <th style={{width:100}}>{t.hsCode}(任意)</th>
                <th style={{width:120}}>{t.expiryDate}(任意)</th>
                <th style={{width:85,textAlign:"right"}}>{t.subtotal}</th>
                <th style={{width:32}}></th>
              </tr></thead>
              <tbody>
                {invoice.items.map((item:any)=>{
                  const ic=item.currency||cur;
                  const sub=Number(item.quantity||0)*Number(item.unitPrice||0);
                  return(
                    <tr key={item.id}>
                      <td>
                        {products.length>0&&(
                          <select className="input" style={{fontSize:11,padding:"3px 5px"}} value=""
                            onChange={(e:any)=>{const p=products.find((pr:any)=>pr.id===e.target.value);if(p)applyProduct(p,item.id);}}>
                            <option value="">選択...</option>
                            {products.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        )}
                      </td>
                      <td><input className="input" value={item.productName||""} placeholder={t.productName} onChange={(e:any)=>upd(item.id,"productName",e.target.value)}/></td>
                      <td><input className="input" type="number" value={item.quantity||""} placeholder="0" onChange={(e:any)=>upd(item.id,"quantity",e.target.value)}/></td>
                      <td><input className="input" type="number" value={item.unitPrice||""} placeholder="0" onChange={(e:any)=>upd(item.id,"unitPrice",e.target.value)}/></td>
                      <td><select className="input" value={item.currency||cur} onChange={(e:any)=>upd(item.id,"currency",e.target.value)}>
                        {CURRENCIES.map((c:string)=><option key={c}>{c}</option>)}</select></td>
                      <td><input className="input" value={item.hsCode||""} placeholder="任意" onChange={(e:any)=>upd(item.id,"hsCode",e.target.value)}/></td>
                      <td><input className="input" type="text" placeholder="YYYY/MM" value={item.expiryDate||""} onChange={(e:any)=>upd(item.id,"expiryDate",e.target.value)}/></td>
                      <td style={{fontWeight:500,fontSize:12,textAlign:"right",paddingRight:6}}>{fmt(sub,ic)}</td>
                      <td><button className="btn btn-danger btn-xs" onClick={()=>del(item.id)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {(invoice.items?.length>0)&&(
          <div className="total-row">
            <div><div className="total-label">{t.totalAmount}</div><div className="total-value">{cur} {fmt(total,cur)}</div></div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">{t.remarks}</div></div>
        <div className="field">
          <textarea className="input" value={invoice.remarks||""} rows={3}
            onChange={(e:any)=>setInvoice((v:any)=>({...v,remarks:e.target.value}))}/>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <button className="btn btn-primary" onClick={onNext}>{t.packingList}へ / 次のステップへ →</button>
      </div>
    </div>
  );
}

// ============================================================
// PACKING LIST FORM
// ============================================================
function PackingForm({invoice,packing,setPacking,onNext,onBack,lang,products}:any){
  const t=T[lang||"ja"];
  const invProducts=(invoice.items||[]).map((i:any)=>i.productName).filter(Boolean);

  const addCarton=()=>{
    const nextNo=(packing.length>0?Math.max(...packing.map((p:any)=>Number(p.cartonNo)||0)):0)+1;
    setPacking((v:any[])=>[...v,{id:Date.now(),cartonNo:nextNo,grossWeight:"",netWeight:"",dimL:"",dimW:"",dimH:"",lines:[{id:Date.now()+1,productName:invProducts[0]||"",quantity:""}],isFraction:false}]);
  };
  const updCarton=(cid:number,f:string,val:any)=>setPacking((v:any[])=>v.map((c:any)=>c.id===cid?{...c,[f]:val}:c));
  const delCarton=(cid:number)=>setPacking((v:any[])=>v.filter((c:any)=>c.id!==cid));
  const addLine=(cid:number)=>setPacking((v:any[])=>v.map((c:any)=>c.id===cid?{...c,lines:[...c.lines,{id:Date.now(),productName:"",quantity:""}]}:c));
  const updLine=(cid:number,lid:number,f:string,val:any)=>setPacking((v:any[])=>v.map((c:any)=>c.id===cid?{...c,lines:c.lines.map((l:any)=>l.id===lid?{...l,[f]:val}:l)}:c));
  const delLine=(cid:number,lid:number)=>setPacking((v:any[])=>v.map((c:any)=>c.id===cid?{...c,lines:c.lines.filter((l:any)=>l.id!==lid)}:c));

  const autoFill=()=>{
    if(!invoice.items?.length)return;
    const newCartons:any[]=[];
    let cartonNo=1;

    // cartons_per_box設定済みの品目：品目ごとにカートン分割
    // cartons_per_box未設定の品目：全品目をまとめて1カートン（混載）
    const itemsWithBox:any[]=[];
    const itemsNoBox:any[]=[];
    invoice.items.forEach((item:any)=>{
      const masterProduct=products.find((p:any)=>p.name===item.productName);
      const perBox=masterProduct?.cartons_per_box?Number(masterProduct.cartons_per_box):0;
      if(perBox>0){itemsWithBox.push({item,masterProduct,perBox});}
      else{itemsNoBox.push({item,masterProduct});}
    });

    // cartons_per_box設定済み品目：品目ごとにカートン作成
    itemsWithBox.forEach(({item,masterProduct,perBox})=>{
      const netW=masterProduct?.net_weight_per_unit?Number(masterProduct.net_weight_per_unit):0;
      const grossW=masterProduct?.weight?Number(masterProduct.weight):0;
      const totalQty=Number(item.quantity||0);
      const fullCartons=Math.floor(totalQty/perBox);
      const fraction=totalQty%perBox;
      for(let i=0;i<fullCartons;i++){
        newCartons.push({
          id:Date.now()+cartonNo,cartonNo:cartonNo++,
          grossWeight:grossW>0?(perBox*grossW).toFixed(3):"",
          netWeight:netW>0?(perBox*netW).toFixed(3):"",
          dimL:"",dimW:"",dimH:"",
          lines:[{id:Date.now()+cartonNo+100,productName:item.productName,quantity:perBox}],
          isFraction:false,
        });
      }
      if(fraction>0){
        newCartons.push({
          id:Date.now()+cartonNo,cartonNo:cartonNo++,
          grossWeight:grossW>0?(fraction*grossW).toFixed(3):"",
          netWeight:netW>0?(fraction*netW).toFixed(3):"",
          dimL:"",dimW:"",dimH:"",
          lines:[{id:Date.now()+cartonNo+100,productName:item.productName,quantity:fraction}],
          isFraction:true,
        });
      }
    });

    // cartons_per_box未設定品目：全品目を1カートンにまとめる（混載）
    if(itemsNoBox.length>0){
      const totalGrossW=itemsNoBox.reduce((s:number,{item,masterProduct}:any)=>{
        const grossW=masterProduct?.weight?Number(masterProduct.weight):0;
        return s+grossW*Number(item.quantity||0);
      },0);
      const totalNetW=itemsNoBox.reduce((s:number,{item,masterProduct}:any)=>{
        const netW=masterProduct?.net_weight_per_unit?Number(masterProduct.net_weight_per_unit):0;
        return s+netW*Number(item.quantity||0);
      },0);
      newCartons.push({
        id:Date.now()+cartonNo,cartonNo:cartonNo++,
        grossWeight:totalGrossW>0?totalGrossW.toFixed(3):"",
        netWeight:totalNetW>0?totalNetW.toFixed(3):"",
        dimL:"",dimW:"",dimH:"",
        lines:itemsNoBox.map(({item}:any,li:number)=>({
          id:Date.now()+cartonNo+200+li,
          productName:item.productName,
          quantity:Number(item.quantity||0),
        })),
        isFraction:false,
      });
    }

    setPacking(newCartons);
  };

  const totalGross=packing.reduce((s:number,c:any)=>s+Number(c.grossWeight||0),0);
  const totalNet=packing.reduce((s:number,c:any)=>s+Number(c.netWeight||0),0);
  const totalQty=packing.reduce((s:number,c:any)=>s+(c.lines||[]).reduce((ss:number,l:any)=>ss+Number(l.quantity||0),0),0);

  const qtyWarnings:string[]=[];
  (invoice.items||[]).forEach((inv:any)=>{
    const pq=packing.reduce((s:number,c:any)=>s+(c.lines||[]).filter((l:any)=>l.productName===inv.productName).reduce((ss:number,l:any)=>ss+Number(l.quantity||0),0),0);
    const iq=Number(inv.quantity||0);
    if(iq>0&&pq>0&&iq!==pq)qtyWarnings.push(`「${inv.productName}」: Invoice ${iq} / Packing ${pq}`);
  });

  return(
    <div className="fade-in">
      {qtyWarnings.length>0&&(
        <div className="validation-panel HIGH" style={{marginBottom:12}}>
          <div className="v-title"><span>🚨</span><span>数量不一致</span></div>
          {qtyWarnings.map((w,i)=><div key={i} className="v-item"><span className="risk-badge HIGH">HIGH</span><span style={{color:"var(--red)"}}>{w}</span></div>)}
        </div>
      )}
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">{t.packingList}</div><div className="card-subtitle">1カートンに複数製品を混載できます。端数は🟡で表示。</div></div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button className="btn btn-secondary btn-sm" onClick={autoFill}>{t.autoFill}</button>
            <button className="btn btn-secondary btn-sm" onClick={()=>{
              const l=prompt("全カートンに適用するサイズを入力\n例: 50x30x20 (L×W×H)");
              if(!l)return;
              const parts=l.trim().split(/[xX×✕]/);
              if(parts.length>=3){
                setPacking((prev:any[])=>prev.map((c:any)=>({...c,dimL:parts[0].trim(),dimW:parts[1].trim(),dimH:parts[2].trim()})));
              }
            }}>📦 サイズ一括設定</button>
            <button className="btn btn-primary btn-sm" onClick={addCarton}>{t.addCarton}</button>
          </div>
        </div>
        {packing.length===0?(
          <div className="empty-state"><div className="empty-icon">📦</div><div style={{fontSize:13}}>「{t.autoFill}」または「{t.addCarton}」で開始</div></div>
        ):packing.map((carton:any)=>(
          <div key={carton.id} className={`carton-block ${carton.isFraction?"carton-fraction":""}`}>
            <div className="carton-header">
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                {carton.isFraction&&<span style={{fontSize:11,fontWeight:700,color:"var(--amber)"}}>⚠️ 端数</span>}
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:11,fontWeight:600,color:"var(--text-muted)"}}>{t.cartonNo}</span>
                  <input className="input" type="number" value={carton.cartonNo} style={{width:55,padding:"3px 7px",fontSize:12}} onChange={(e:any)=>updCarton(carton.id,"cartonNo",e.target.value)}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:11,fontWeight:600,color:"var(--text-muted)"}}>{t.grossWeight}<span style={{color:"var(--red)"}}>*</span></span>
                  <input className={`input ${!carton.grossWeight?"error":""}`} type="number" value={carton.grossWeight||""} style={{width:75,padding:"3px 7px",fontSize:12}} placeholder="0.00" onChange={(e:any)=>updCarton(carton.id,"grossWeight",e.target.value)}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:11,fontWeight:600,color:"var(--text-muted)"}}>{t.netWeight}</span>
                  <input className="input" type="number" value={carton.netWeight||""} style={{width:75,padding:"3px 7px",fontSize:12}} placeholder="0.00" onChange={(e:any)=>updCarton(carton.id,"netWeight",e.target.value)}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:11,fontWeight:600,color:"var(--text-muted)"}}>L×W×H(cm)</span>
                  <input className="input" type="number" value={carton.dimL||""} style={{width:52,padding:"3px 5px",fontSize:12}} placeholder="L" onChange={(e:any)=>updCarton(carton.id,"dimL",e.target.value)}/>
                  <span style={{color:"var(--text-muted)"}}>×</span>
                  <input className="input" type="number" value={carton.dimW||""} style={{width:52,padding:"3px 5px",fontSize:12}} placeholder="W" onChange={(e:any)=>updCarton(carton.id,"dimW",e.target.value)}/>
                  <span style={{color:"var(--text-muted)"}}>×</span>
                  <input className="input" type="number" value={carton.dimH||""} style={{width:52,padding:"3px 5px",fontSize:12}} placeholder="H" onChange={(e:any)=>updCarton(carton.id,"dimH",e.target.value)}/>
                </div>
                <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,cursor:"pointer"}}>
                  <input type="checkbox" checked={carton.isFraction||false} onChange={(e:any)=>updCarton(carton.id,"isFraction",e.target.checked)}/>端数カートン
                </label>
              </div>
              <button className="btn btn-danger btn-xs" onClick={()=>delCarton(carton.id)}>削除</button>
            </div>
            <div className="carton-lines">
              <div style={{display:"grid",gridTemplateColumns:"1fr 80px 32px",gap:7,marginBottom:3}}>
                <span style={{fontSize:11,fontWeight:600,color:"var(--text-muted)"}}>{t.productName}</span>
                <span style={{fontSize:11,fontWeight:600,color:"var(--text-muted)"}}>{t.qty}</span>
                <span></span>
              </div>
              {(carton.lines||[]).map((line:any)=>(
                <div key={line.id} style={{display:"grid",gridTemplateColumns:"1fr 80px 32px",gap:7,alignItems:"center",marginBottom:5}}>
                  <select className="input" value={line.productName||""} style={{fontSize:12}}
                    onChange={(e:any)=>updLine(carton.id,line.id,"productName",e.target.value)}>
                    <option value="">{lang==="en"?"Select product":"製品を選択"}</option>
                    {invProducts.map((n:string)=><option key={n} value={n}>{n}</option>)}
                  </select>
                  <input className="input" type="number" value={line.quantity||""} placeholder="0" style={{fontSize:12}}
                    onChange={(e:any)=>updLine(carton.id,line.id,"quantity",e.target.value)}/>
                  <button className="btn btn-danger btn-xs" onClick={()=>delLine(carton.id,line.id)}
                    disabled={(carton.lines||[]).length<=1} style={{opacity:(carton.lines||[]).length<=1?0.3:1}}>✕</button>
                </div>
              ))}
              <button className="btn btn-secondary btn-xs" style={{marginTop:3}} onClick={()=>addLine(carton.id)}>
                + {t.mixed}品目追加
              </button>
              <div style={{marginTop:5,fontSize:11,color:"var(--text-muted)"}}>
                このカートン計: <strong>{(carton.lines||[]).reduce((s:number,l:any)=>s+Number(l.quantity||0),0)} pcs</strong>
              </div>
            </div>
          </div>
        ))}
        {packing.length>0&&(
          <div style={{display:"flex",gap:20,marginTop:10,padding:"10px 14px",background:"#F7F7F5",borderRadius:"var(--radius-lg)"}}>
            <div><div className="total-label">カートン数</div><div className="total-value">{packing.length} ctns</div></div>
            <div><div className="total-label">合計数量</div><div className="total-value">{totalQty} pcs</div></div>
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
function ReviewPage({invoice,packing,onNext,onBack,setStep,lang}:any){
  const t=T[lang||"ja"];
  const {errors,riskLevel}=useMemo(()=>validate(invoice,packing),[invoice,packing]);
  const total=(invoice.items||[]).reduce((s:number,it:any)=>s+(Number(it.quantity||0)*Number(it.unitPrice||0)),0);
  const cur=invoice.currency||"JPY";
  const checks=[
    {label:"Invoice No 入力済み",ok:!!invoice.invoiceNo},
    {label:"Shipper 入力済み",ok:!!invoice.shipper},
    {label:"Consignee 入力済み",ok:!!invoice.consignee},
    {label:"品目 1件以上",ok:(invoice.items?.length||0)>0},
    {label:"Incoterms 選択済み",ok:!!invoice.incoterms},
    {label:"原産国 入力済み",ok:!!invoice.countryOfOrigin},
    {label:"Packing List 作成済み",ok:packing.length>0},
    {label:"重量入力済み",ok:packing.every((c:any)=>c.grossWeight&&Number(c.grossWeight)>0)},
  ];
  return(
    <div className="fade-in">
      <ValidationPanel invoice={invoice} packing={packing} setStep={setStep}/>
      <div className="grid-2" style={{marginBottom:14}}>
        <div className="card">
          <div className="card-title" style={{marginBottom:12}}>📋 チェックリスト ({checks.filter(c=>c.ok).length}/{checks.length})</div>
          {checks.map((c,i)=>(
            <div key={i} className="checklist-item">
              <div className={`check-icon ${c.ok?"check-ok":"check-fail"}`}>{c.ok?"✓":"✕"}</div>
              <span style={{fontSize:12,color:c.ok?"var(--text)":"var(--red)"}}>{c.label}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title" style={{marginBottom:12}}>📊 サマリー</div>
          <table style={{width:"100%",fontSize:12}}>
            <tbody>
              {[
                ["書類タイプ",invoice.invoiceType==="proforma"?"Proforma Invoice":"Commercial Invoice"],
                ["Invoice No",invoice.invoiceNo||"—"],["日付",invoice.date||"—"],
                ["Incoterms",invoice.incoterms||"—"],["原産国",invoice.countryOfOrigin||"—"],
                ["品目数",`${invoice.items?.length||0}件`],
                ["合計金額",`${cur} ${fmt(total,cur)}`],
                ["カートン数",`${packing.length} ctns`],
                ["総重量",`${packing.reduce((s:number,c:any)=>s+Number(c.grossWeight||0),0).toFixed(2)} kg`],
              ].map(([k,v]:any)=>(
                <tr key={k}><td style={{color:"var(--text-muted)",padding:"4px 0",borderBottom:"1px solid var(--border)"}}>{k}</td>
                <td style={{fontWeight:500,textAlign:"right",padding:"4px 0",borderBottom:"1px solid var(--border)"}}>{v}</td></tr>
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
// PDF OUTPUT
// ============================================================
function OutputPage({invoice,packing,onBack,org,lang,onSave,onNext}:any){
  const t=T[lang||"ja"];
  const isProforma=invoice.invoiceType==="proforma";
  const [activeDoc,setActiveDoc]=useState("proforma");
  const [invoiceItems,setInvoiceItems]=useState<any[]>(invoice.invoice_items||invoice.items||[]);
  const [commercialItems,setCommercialItems]=useState<any[]>(invoice.commercial_items||invoice.items||[]);
  const [invoiceRemarks,setInvoiceRemarks]=useState(invoice.invoice_remarks||invoice.remarks||"");
  const [commercialRemarks,setCommercialRemarks]=useState(invoice.commercial_remarks||invoice.remarks||"");
  const total=(invoice.items||[]).reduce((s:number,it:any)=>s+(Number(it.quantity||0)*Number(it.unitPrice||0)),0);
  const cur=invoice.currency||"JPY";

  const updItem=(list:any[],setList:any,id:any,key:string,val:any)=>
    setList((prev:any[])=>prev.map((it:any)=>it.id===id?{...it,[key]:val}:it));
  const delItem=(list:any[],setList:any,id:any)=>
    setList((prev:any[])=>prev.filter((it:any)=>it.id!==id));
  const addItem=(setList:any)=>
    setList((prev:any[])=>[...prev,{id:Date.now(),productName:"",hsCode:"",quantity:0,unitPrice:0}]);

  const [printLang,setPrintLang]=useState(invoice.language||"ja");
  const updInvItem=(id:any,k:string,v:any)=>updItem(invoiceItems,setInvoiceItems,id,k,v);
  const delInvItem=(id:any)=>delItem(invoiceItems,setInvoiceItems,id);
  const addInvItem=()=>addItem(setInvoiceItems);
  const updComItem=(id:any,k:string,v:any)=>updItem(commercialItems,setCommercialItems,id,k,v);
  const delComItem=(id:any)=>delItem(commercialItems,setCommercialItems,id);
  const addComItem=()=>addItem(setCommercialItems);

  // カートンを行に展開（rowspan用：カートン単位でグループ化）
  // packingRows = カートン1つ＝1グループ、各グループにlines[]を持つ
  // 旧データ互換：linesがない場合はcartonのproductName/quantityをlinesに変換
  const packingRows:any[]=packing.map((carton:any)=>{
    let lines=(carton.lines||[]).map((l:any)=>({
      productName:l.productName||"",
      quantity:l.quantity||0,
      expiryDate:l.expiryDate||"",
    }));
    // 旧データ互換：linesが空でcarton直接にproductNameがある場合
    if(lines.length===0&&carton.productName){
      lines=[{productName:carton.productName,quantity:carton.quantity||0,expiryDate:carton.expiryDate||""}];
    }
    return {
      cartonNo:carton.cartonNo,
      grossWeight:Number(carton.grossWeight||0).toFixed(2),
      netWeight:Number(carton.netWeight||0).toFixed(2),
      dimensions:[carton.dimL,carton.dimW,carton.dimH].every(Boolean)?`${carton.dimL}x${carton.dimW}x${carton.dimH}`:"—",
      isFraction:carton.isFraction,
      lines,
    };
  });

  const ROWS_PER_PAGE=15;
  const packingPages:any[][]=[];
  for(let i=0;i<packingRows.length;i+=ROWS_PER_PAGE){
    packingPages.push(packingRows.slice(i,i+ROWS_PER_PAGE));
  }
  if(packingPages.length===0)packingPages.push([]);

  const printStyle=`
    @page{margin:15mm;size:A4;margin-top:10mm;margin-bottom:10mm}
    @page{-webkit-margin-before:0;-webkit-margin-after:0}
    html{-webkit-print-color-adjust:exact}
    *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}
    body{font-family:sans-serif;font-size:10px;color:#000}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #ccc;padding:4px 6px}
    th{border:1px solid #666;font-size:10px;font-weight:700;padding:6px 8px;background:#fff !important;color:#000 !important}
    tr:nth-child(even) td{background:#fff !important}
    .pdf-header{margin-bottom:12px}
    .pdf-title{font-size:26px;font-weight:800;letter-spacing:3px;border-bottom:3px solid #000;padding-bottom:8px;margin-bottom:16px}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px}
    .meta-item{padding:4px 0;border-bottom:1px solid #eee}
    .meta-key{font-size:8px;font-weight:600;text-transform:uppercase;color:#666;margin-bottom:1px}
    .address-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px}
    .total-section{margin-top:12px;text-align:right;border-top:2px solid #000;padding-top:8px;font-size:12px;font-weight:700}
    .signature-section{margin-top:40px;display:flex;justify-content:flex-end}
    .signature-box{text-align:center;min-width:200px}
    .page-break{page-break-after:always}
    .no-break{page-break-inside:avoid}
    thead{display:table-header-group}
    tfoot{display:table-footer-group}
    .no-print{display:none !important}
    .bank-section{margin-top:16px;font-size:9px;border:1px solid #ddd;padding:8px;border-radius:4px}
    .bank-title{font-size:8px;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:6px}.no-print{display:none !important}
  `;

  const handlePrint=()=>{
    const el=document.getElementById("print-area");
    if(!el)return;
    const w=window.open("","_blank","width=794,height=1123");
    if(!w)return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${activeDoc==="proforma"?"Proforma Invoice":activeDoc==="commercial"?"Invoice":"Packing List"}</title><style>@page{margin:10mm;size:A4}@media print{html,body{margin:0 !important;padding:0 !important}}${printStyle}</style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(()=>{w.print();},500);
  };

  // 全書類（Proforma/Invoice/Commercial/Packing List）を一括で印刷
  const handlePrintAll=()=>{
    const buildInvoiceSection=(title:string,items:any[],remarks:string,showBank:boolean)=>{
      const showExp=items.some((it:any)=>it.expiryDate);
      const rows=items.map((it:any,i:number)=>`
        <tr style="background:${i%2===0?"#ffffff":"#f5f5f5"}">
          <td style="border:1px solid #ddd;padding:4px 6px">${it.productName||""}</td>
          <td style="border:1px solid #ddd;padding:4px 6px;font-family:monospace">${it.hsCode||""}</td>
          <td style="border:1px solid #ddd;padding:4px 6px;text-align:right">${it.quantity||0}</td>
          <td style="border:1px solid #ddd;padding:4px 6px;text-align:right">${it.unitPrice||0}</td>
          <td style="border:1px solid #ddd;padding:4px 6px;text-align:right">${cur} ${fmt(Number(it.quantity||0)*Number(it.unitPrice||0),cur)}</td>
          ${showExp?`<td style="border:1px solid #ddd;padding:4px 6px">${fmtExpiry(it.expiryDate||"")}</td>`:""}
        </tr>`).join("");
      const total=items.reduce((s:number,it:any)=>s+(Number(it.quantity||0)*Number(it.unitPrice||0)),0);
      const bankSection=showBank&&org?.bankName?`
        <div style="margin-top:16px;font-size:9px;border:1px solid #ddd;padding:8px;border-radius:4px">
          <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:6px">Banking Information</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            ${org.bankName?`<div><span style="color:#666">Bank: </span>${org.bankName}</div>`:""}
            ${org.bankBranch?`<div><span style="color:#666">Branch: </span>${org.bankBranch}</div>`:""}
            ${org.bankAddress?`<div style="grid-column:1/-1"><span style="color:#666">Address: </span>${org.bankAddress}</div>`:""}
            ${org.accountNo?`<div><span style="color:#666">Account: </span>${org.accountNo}</div>`:""}
            ${org.swiftCode?`<div><span style="color:#666">SWIFT: </span>${org.swiftCode}</div>`:""}
          </div>
        </div>`:"";
      const sigSection=`
        <div style="margin-top:40px;display:flex;justify-content:flex-end">
          <div style="text-align:center;min-width:200px">
            ${org?.signatureBase64?`<img src="${org.signatureBase64}" style="height:50px;object-fit:contain;margin-bottom:4px"/>`:`<div style="height:50px;border-bottom:1px solid #000;margin-bottom:4px"></div>`}
            <div style="font-size:10px;font-weight:600">${org?.signerName||""}</div>
            <div style="font-size:9px;color:#666">${org?.signerTitle||""}</div>
          </div>
        </div>`;
      return `
        <div style="background:#fff;width:794px;margin:0 auto;padding:40px 50px;font-size:11px;color:#000;page-break-after:always">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
            <div><div style="font-size:32px;font-weight:800;letter-spacing:2px">${title}</div>
            ${invoice.invoiceNo?`<div style="font-size:11px;color:#444">No. <strong>${invoice.invoiceNo}</strong></div>`:""}
            </div>
            <div style="text-align:right;font-size:10px">
              ${org?.logoBase64?`<img src="${org.logoBase64}" style="max-height:60px;max-width:200px;object-fit:contain;margin-bottom:4px;display:block;margin-left:auto"/>`:""}
              ${org?.companyName?`<div style="font-weight:700;font-size:12px">${org.companyName}</div>`:""}
              ${org?.address?`<div style="white-space:pre-wrap">${org.address}</div>`:""}
              ${org?.tel?`<div>Tel: ${org.tel}</div>`:""}
            </div>
          </div>
          <div style="height:2px;background:#000;margin-bottom:16px"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">
            <div style="padding:4px 0;border-bottom:1px solid #eee"><div style="font-size:8px;font-weight:600;text-transform:uppercase;color:#666">Invoice No.</div><strong>${invoice.invoiceNo||"—"}</strong></div>
            <div style="padding:4px 0;border-bottom:1px solid #eee"><div style="font-size:8px;font-weight:600;text-transform:uppercase;color:#666">Date</div>${invoice.date||"—"}</div>
            <div style="padding:4px 0;border-bottom:1px solid #eee"><div style="font-size:8px;font-weight:600;text-transform:uppercase;color:#666">Incoterms</div>${invoice.incoterms||"—"}</div>
            <div style="padding:4px 0;border-bottom:1px solid #eee"><div style="font-size:8px;font-weight:600;text-transform:uppercase;color:#666">Country of Origin</div>${invoice.countryOfOrigin||"—"}</div>
            ${invoice.poNumber?`<div style="padding:4px 0;border-bottom:1px solid #eee"><div style="font-size:8px;font-weight:600;text-transform:uppercase;color:#666">P.O. Number</div>${invoice.poNumber}</div>`:""}
            ${invoice.shippingMethod?`<div style="padding:4px 0;border-bottom:1px solid #eee"><div style="font-size:8px;font-weight:600;text-transform:uppercase;color:#666">Shipping Method</div>${invoice.shippingMethod}</div>`:""}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px">
            <div><div style="font-size:8px;font-weight:600;text-transform:uppercase;color:#666;margin-bottom:3px">SHIPPER</div><div style="white-space:pre-wrap;font-size:10px">${invoice.shipper||"—"}</div></div>
            <div><div style="font-size:8px;font-weight:600;text-transform:uppercase;color:#666;margin-bottom:3px">CONSIGNEE</div><div style="white-space:pre-wrap;font-size:10px">${invoice.consignee||"—"}</div>
            ${invoice.shipTo?`<div style="font-size:8px;font-weight:600;text-transform:uppercase;color:#666;margin-top:8px;margin-bottom:3px">SHIP TO</div><div style="white-space:pre-wrap;font-size:10px">${invoice.shipTo}</div>`:""}
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-top:12px">
            <thead><tr style="border-bottom:2px solid #000">
              <th style="border:1px solid #666;padding:6px 8px;font-size:10px;font-weight:700;text-align:left">Description</th>
              <th style="border:1px solid #666;padding:6px 8px;font-size:10px;font-weight:700;text-align:left">HS Code</th>
              <th style="border:1px solid #666;padding:6px 8px;font-size:10px;font-weight:700;text-align:right;width:60px">Qty</th>
              <th style="border:1px solid #666;padding:6px 8px;font-size:10px;font-weight:700;text-align:right;width:90px">Unit Price</th>
              <th style="border:1px solid #666;padding:6px 8px;font-size:10px;font-weight:700;text-align:right;width:100px">Amount</th>
              ${showExp?`<th style="border:1px solid #666;padding:6px 8px;font-size:10px;font-weight:700;width:90px">${printLang==="en"?"Expiry":"賞味/使用期限"}</th>`:""}
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td colspan="${showExp?6:5}" style="padding:8px;text-align:right;font-weight:700;font-size:12px;border-top:2px solid #000">TOTAL: ${cur} ${fmt(total,cur)}</td></tr></tfoot>
          </table>
          ${remarks?`<div style="margin-top:10px"><div style="font-size:9px;font-weight:600;color:#666;margin-bottom:3px;text-transform:uppercase">Remarks</div><div style="font-size:10px;white-space:pre-wrap">${remarks}</div></div>`:""}
          ${bankSection}
          ${sigSection}
        </div>`;
    };

    const buildPackingSection=()=>{
      const hasExpiryPrint=packingRows.some((r:any)=>(r.lines||[]).some((l:any)=>l.expiryDate));
      const rows=packingRows.map((row:any)=>{
        const lines=row.lines||[];
        const rs=lines.length||1;
        if(lines.length===0)return `<tr><td style="border:1px solid #ccc;padding:4px 6px;text-align:center">${row.cartonNo}</td><td style="border:1px solid #ccc;padding:4px 6px"></td><td style="border:1px solid #ccc;padding:4px 6px;text-align:right"></td><td style="border:1px solid #ccc;padding:4px 6px;text-align:right">${row.grossWeight}</td><td style="border:1px solid #ccc;padding:4px 6px;text-align:right">${row.netWeight}</td><td style="border:1px solid #ccc;padding:4px 6px">${row.dimensions}</td>${hasExpiryPrint?"<td style='border:1px solid #ccc;padding:4px 6px'></td>":""}</tr>`;
        return lines.map((line:any,li:number)=>`
          <tr>
            ${li===0?`<td style="border:1px solid #ccc;padding:4px 6px;text-align:center;vertical-align:middle" rowspan="${rs}">${row.cartonNo}</td>`:""}
            <td style="border:1px solid #ccc;padding:4px 6px">${line.productName}</td>
            <td style="border:1px solid #ccc;padding:4px 6px;text-align:right">${line.quantity}</td>
            ${li===0?`<td style="border:1px solid #ccc;padding:4px 6px;text-align:right;vertical-align:middle" rowspan="${rs}">${row.grossWeight}</td>`:""}
            ${li===0?`<td style="border:1px solid #ccc;padding:4px 6px;text-align:right;vertical-align:middle" rowspan="${rs}">${row.netWeight}</td>`:""}
            ${li===0?`<td style="border:1px solid #ccc;padding:4px 6px;vertical-align:middle" rowspan="${rs}">${row.dimensions}</td>`:""}
            ${hasExpiryPrint?`<td style="border:1px solid #ccc;padding:4px 6px">${fmtExpiry(line.expiryDate||"")}</td>`:""}
          </tr>`).join("");
      }).join("");
      const totGW=packing.reduce((s:number,c:any)=>s+Number(c.grossWeight||0),0).toFixed(2);
      const totNW=packing.reduce((s:number,c:any)=>s+Number(c.netWeight||0),0).toFixed(2);
      return `
        <div style="background:#fff;width:794px;margin:0 auto;padding:40px 50px;font-size:11px;color:#000">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
            <div>
              <div style="font-size:36px;font-weight:900;letter-spacing:3px;text-transform:uppercase">PACKING LIST</div>
              ${invoice.invoiceNo?`<div style="font-size:11px;color:#444;margin-top:4px">No. <strong>${invoice.invoiceNo}</strong></div>`:""}
            </div>
            <div style="text-align:right;font-size:10px">
              ${org?.logoBase64?`<img src="${org.logoBase64}" style="max-height:70px;max-width:220px;object-fit:contain;margin-bottom:6px;display:block;margin-left:auto"/>`:""}
              ${org?.companyName?`<div style="font-weight:700;font-size:12px">${org.companyName}</div>`:""}
              ${org?.address?`<div style="white-space:pre-wrap;font-size:10px">${org.address}</div>`:""}
              ${org?.tel?`<div style="font-size:10px">Tel: ${org.tel}</div>`:""}
            </div>
          </div>
          <div style="height:2px;background:#000;margin-bottom:20px"></div>
          <table style="width:100%;border-collapse:collapse;margin-top:12px">
            <thead><tr style="border-bottom:2px solid #000">
              <th style="border:1px solid #666;padding:6px 8px;font-size:10px;font-weight:700;width:80px;text-align:center">Carton No</th>
              <th style="border:1px solid #666;padding:6px 8px;font-size:10px;font-weight:700">Description</th>
              <th style="border:1px solid #666;padding:6px 8px;font-size:10px;font-weight:700;text-align:right;width:60px">Qty</th>
              <th style="border:1px solid #666;padding:6px 8px;font-size:10px;font-weight:700;text-align:right;width:80px">G.W.(kg)</th>
              <th style="border:1px solid #666;padding:6px 8px;font-size:10px;font-weight:700;text-align:right;width:80px">N.W.(kg)</th>
              <th style="border:1px solid #666;padding:6px 8px;font-size:10px;font-weight:700;width:100px">Dimensions</th>
              ${packingRows.some((r:any)=>(r.lines||[]).some((l:any)=>l.expiryDate))?`<th style="border:1px solid #666;padding:6px 8px;font-size:10px;font-weight:700">${printLang==="en"?"Expiry":"賞味/使用期限"}</th>`:""}
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr style="font-weight:700;border-top:2px solid #000">
              <td style="border:1px solid #ccc;padding:4px 6px">TOTAL</td>
              <td style="border:1px solid #ccc;padding:4px 6px"></td>
              <td style="border:1px solid #ccc;padding:4px 6px;text-align:right">${packingRows.reduce((s:number,r:any)=>s+(Number(r.quantity)||0),0)}</td>
              <td style="border:1px solid #ccc;padding:4px 6px;text-align:right">${totGW}</td>
              <td style="border:1px solid #ccc;padding:4px 6px;text-align:right">${totNW}</td>
              <td style="border:1px solid #ccc;padding:4px 6px"></td>
              ${packingRows.some((r:any)=>r.expiryDate)?`<td style="border:1px solid #ccc;padding:4px 6px"></td>`:""}
            </tr></tfoot>
          </table>
          <div style="margin-top:40px;display:flex;justify-content:flex-end">
            <div style="text-align:center;min-width:200px">
              ${org?.signatureBase64?`<img src="${org.signatureBase64}" style="height:50px;object-fit:contain;margin-bottom:4px"/>`:`<div style="height:50px;border-bottom:1px solid #000;margin-bottom:4px"></div>`}
              <div style="font-size:10px;font-weight:600">${org?.signerName||""}</div>
              <div style="font-size:9px;color:#666">${org?.signerTitle||""}</div>
            </div>
          </div>
        </div>`;
    };

    const w=window.open("","_blank","width=1100,height=1400");
    if(!w)return;
    const proformaSection=isProforma?buildInvoiceSection("PROFORMA INVOICE",invoiceItems,invoiceRemarks,true):"";
    const invoiceSection=buildInvoiceSection("INVOICE",invoiceItems,invoiceRemarks,true);
    const commercialSection=buildInvoiceSection("COMMERCIAL INVOICE",commercialItems,commercialRemarks,true);
    const packingSection=buildPackingSection();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>全書類一括印刷 - ${invoice.invoiceNo||""}</title>
    <style>@page{margin:10mm;size:A4}@media print{html,body{margin:0 !important;padding:0 !important}} *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important} ${printStyle} body{background:#e8e8e8} .doc-wrapper{padding:24px 0}</style></head>
    <body><div class="doc-wrapper">
      ${proformaSection}
      ${invoiceSection}
      ${commercialSection}
      ${packingSection}
    </div></body></html>`);
    w.document.close();
    setTimeout(()=>{w.print();},600);
  };

  const InvoiceHeader=({title}:{title:string})=>(
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div style={{flex:1}}>
          <div style={{fontSize:32,fontWeight:800,letterSpacing:2,lineHeight:1.1,marginBottom:4}}>{title}</div>
          {invoice.invoiceNo&&<div style={{fontSize:11,color:"#444"}}>{printLang==="en"?"Invoice No.":"請求書番号"} <strong>{invoice.invoiceNo}</strong></div>}
        </div>
        <div style={{textAlign:"right",fontSize:10}}>
          {org?.logoBase64&&<img src={org.logoBase64} alt="logo" style={{maxHeight:60,maxWidth:200,objectFit:"contain",marginBottom:4,display:"block",marginLeft:"auto"}}/>}
          {org?.companyName&&<div style={{fontWeight:700,fontSize:12}}>{org.companyName}</div>}
          {org?.signerName&&<div>{org.signerName}</div>}
          {org?.address&&<div style={{whiteSpace:"pre-wrap"}}>{org.address}</div>}
          {org?.tel&&<div>Tel: {org.tel}</div>}
        </div>
      </div>
      <div style={{height:2,background:"#000",marginBottom:16}}></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
        <div style={{padding:"4px 0",borderBottom:"1px solid #eee"}}><div style={{fontSize:8,fontWeight:600,textTransform:"uppercase" as any,color:"#666",marginBottom:1}}>Invoice No.</div><strong>{invoice.invoiceNo||"—"}</strong></div>
        <div style={{padding:"4px 0",borderBottom:"1px solid #eee"}}><div style={{fontSize:8,fontWeight:600,textTransform:"uppercase" as any,color:"#666",marginBottom:1}}>Date</div>{invoice.date||"—"}</div>
        <div style={{padding:"4px 0",borderBottom:"1px solid #eee"}}><div style={{fontSize:8,fontWeight:600,textTransform:"uppercase" as any,color:"#666",marginBottom:1}}>Incoterms</div>{invoice.incoterms||"—"}</div>
        <div style={{padding:"4px 0",borderBottom:"1px solid #eee"}}><div style={{fontSize:8,fontWeight:600,textTransform:"uppercase" as any,color:"#666",marginBottom:1}}>Country of Origin</div>{invoice.countryOfOrigin||"—"}</div>
        {invoice.poNumber&&<div style={{padding:"4px 0",borderBottom:"1px solid #eee"}}><div style={{fontSize:8,fontWeight:600,textTransform:"uppercase" as any,color:"#666",marginBottom:1}}>P.O. Number</div>{invoice.poNumber}</div>}
        {invoice.paymentDue&&<div style={{padding:"4px 0",borderBottom:"1px solid #eee"}}><div style={{fontSize:8,fontWeight:600,textTransform:"uppercase" as any,color:"#666",marginBottom:1}}>Payment Due</div>{invoice.paymentDue}</div>}
        {invoice.shippingMethod&&<div style={{padding:"4px 0",borderBottom:"1px solid #eee"}}><div style={{fontSize:8,fontWeight:600,textTransform:"uppercase" as any,color:"#666",marginBottom:1}}>Shipping Method</div>{invoice.shippingMethod}</div>}
        {invoice.portOfLoading&&<div style={{padding:"4px 0",borderBottom:"1px solid #eee"}}><div style={{fontSize:8,fontWeight:600,textTransform:"uppercase" as any,color:"#666",marginBottom:1}}>Port of Loading</div>{invoice.portOfLoading}</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}>
        <div><div className="meta-key" style={{marginBottom:3}}>SHIPPER</div><div style={{whiteSpace:"pre-wrap",fontSize:10}}>{invoice.shipper||"—"}</div></div>
        <div>
          <div className="meta-key" style={{marginBottom:3}}>CONSIGNEE</div>
          <div style={{whiteSpace:"pre-wrap",fontSize:10}}>{invoice.consignee||"—"}</div>
          {invoice.shipTo&&<><div className="meta-key" style={{marginBottom:3,marginTop:8}}>SHIP TO</div><div style={{whiteSpace:"pre-wrap",fontSize:10}}>{invoice.shipTo}</div></>}
        </div>
      </div>
    </>
  );

  const MetaRow=({label,value}:any)=>(
    <div style={{display:"flex",padding:"5px 0",borderBottom:"1px solid #eee"}}>
      <div style={{width:120,color:"#555",fontSize:10}}>{label}</div>
      <div style={{flex:1,fontSize:10,fontWeight:500}}>{value||"—"}</div>
    </div>
  );

  const PackingHeader=()=>(
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div style={{flex:1}}>
          <div style={{fontSize:32,fontWeight:800,letterSpacing:2,lineHeight:1.1,marginBottom:4}}>PACKING LIST</div>
          {invoice.invoiceNo&&<div style={{fontSize:11,color:"#444"}}>{printLang==="en"?"Invoice No.":"請求書番号"} <strong>{invoice.invoiceNo}</strong></div>}
        </div>
        <div style={{textAlign:"right",fontSize:10}}>
          {org?.logoBase64&&<img src={org.logoBase64} alt="logo" style={{maxHeight:60,maxWidth:200,objectFit:"contain",marginBottom:4,display:"block",marginLeft:"auto"}}/>}
          {org?.companyName&&<div style={{fontWeight:700,fontSize:12}}>{org.companyName}</div>}
          {org?.signerName&&<div>{org.signerName}</div>}
          {org?.address&&<div style={{whiteSpace:"pre-wrap"}}>{org.address}</div>}
          {org?.tel&&<div>Tel: {org.tel}</div>}
        </div>
      </div>
      <div style={{height:2,background:"#000",marginBottom:16}}></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px",marginBottom:16}}>
        <div>
          <MetaRow label={printLang==="en"?"Date:":"請求日："} value={invoice.date}/>
          {invoice.paymentTerms&&<MetaRow label={printLang==="en"?"Payment Terms:":"支払い条件："} value={invoice.paymentTerms}/>}
          {invoice.paymentDue&&<MetaRow label={printLang==="en"?"Payment Due:":"支払い期限："} value={invoice.paymentDue}/>}
          {invoice.poNumber&&<MetaRow label={printLang==="en"?"P.O. No:":"発注番号："} value={invoice.poNumber}/>}
          {invoice.shippingMethod&&<MetaRow label="Shipping Method：" value={invoice.shippingMethod}/>}
          {invoice.incoterms&&<MetaRow label="Incoterms：" value={invoice.incoterms}/>}
          <MetaRow label="Total Cartons：" value={`${packing.length} CTNS`}/>
          <MetaRow label="Total G.W.：" value={`${packing.reduce((s:number,c:any)=>s+Number(c.grossWeight||0),0).toFixed(2)} kg`}/>
        </div>
        <div>
          <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase" as any,color:"#555",marginBottom:4}}>{printLang==="en"?"CONSIGNEE":"請求先"}</div>
          {invoice.consignee&&<div style={{fontWeight:700,fontSize:11,marginBottom:2}}>{invoice.consignee.split("\n")[0]}</div>}
          <div style={{whiteSpace:"pre-wrap",fontSize:10,color:"#333"}}>{invoice.consignee?.split("\n").slice(1).join("\n")||""}</div>
          {invoice.shipTo&&<>
            <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase" as any,color:"#555",marginTop:8,marginBottom:4}}>SHIP TO</div>
            <div style={{whiteSpace:"pre-wrap",fontSize:10}}>{invoice.shipTo}</div>
          </>}
        </div>
      </div>
    </>
  );

  const SignatureSection=()=>(
    <div style={{marginTop:40,display:"flex",justifyContent:"flex-end"}}>
      <div style={{textAlign:"center",minWidth:200}}>
        {org?.signatureBase64?<img src={org.signatureBase64} alt="signature" style={{height:50,objectFit:"contain",marginBottom:4}}/>:<div style={{height:50,borderBottom:"1px solid #000",marginBottom:4}}></div>}
        <div style={{fontSize:10,fontWeight:600}}>{org?.signerName||""}</div>
        <div style={{fontSize:9,color:"#666"}}>{org?.signerTitle||""}</div>
      </div>
    </div>
  );

  return(
    <div className="fade-in">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div className="tabs no-print" style={{marginBottom:0}}>
          <button className={`tab ${activeDoc==="proforma"?"active":""}`} onClick={()=>setActiveDoc("proforma")}>📋 Proforma Invoice</button>
          <button className={`tab ${activeDoc==="invoice"?"active":""}`} onClick={()=>setActiveDoc("invoice")}>📄 Invoice</button>
          <button className={`tab ${activeDoc==="commercial"?"active":""}`} onClick={()=>setActiveDoc("commercial")}>📄 Commercial Invoice</button>
          <button className={`tab ${activeDoc==="packing"?"active":""}`} onClick={()=>setActiveDoc("packing")}>📦 Packing List</button>
          <button className={`tab ${activeDoc==="delivery"?"active":""}`} onClick={()=>setActiveDoc("delivery")}>🚚 Delivery Note</button>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}} className="no-print">
          <div style={{display:"flex",background:"#F0EEE9",borderRadius:8,padding:3,gap:2}}>
            <button className={`btn btn-xs ${printLang==="ja"?"btn-primary":"btn-secondary"}`}
              onClick={()=>setPrintLang("ja")} style={{padding:"3px 10px",fontSize:11}}>日本語</button>
            <button className={`btn btn-xs ${printLang==="en"?"btn-primary":"btn-secondary"}`}
              onClick={()=>setPrintLang("en")} style={{padding:"3px 10px",fontSize:11}}>EN</button>
          </div>
          <button className="btn btn-green btn-sm" onClick={handlePrintAll} title="全書類一括印刷">
            🖨️ 全書類一括印刷
          </button>
        </div>
      </div>
      <div className="card">
        <div className="card-header no-print">
          <div className="card-title">{activeDoc==="invoice"?(isProforma?"Proforma Invoice プレビュー":"Invoice プレビュー"):"Packing List プレビュー"}</div>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>🖨️ {t.print}</button>
        </div>
        <div id="print-area" style={{background:"#fff",padding:"0"}}>
          {(()=>{
            const showExp=(invoiceItems||[]).some((it:any)=>it.expiryDate)||(commercialItems||[]).some((it:any)=>it.expiryDate);
            const editTable=(items:any[],updFn:any,delFn:any,addFn:any,showExp:boolean,remarks:string,setRemarks:any,docCur:string)=>(
                <>
                  <table style={{width:"100%",borderCollapse:"collapse",marginTop:12}}>
                    <thead><tr style={{borderBottom:"2px solid #000"}}>
                      <th style={{border:"1px solid #666",padding:"6px 8px",fontSize:10,fontWeight:700,textAlign:"left"}}>Description of Goods</th>
                      <th style={{border:"1px solid #666",padding:"6px 8px",fontSize:10,fontWeight:700,textAlign:"left"}}>HS Code</th>
                      <th style={{border:"1px solid #666",padding:"6px 8px",fontSize:10,fontWeight:700,textAlign:"right",width:60}}>Qty</th>
                      <th style={{border:"1px solid #666",padding:"6px 8px",fontSize:10,fontWeight:700,textAlign:"right",width:90}}>Unit Price</th>
                      <th style={{border:"1px solid #666",padding:"6px 8px",fontSize:10,fontWeight:700,textAlign:"right",width:100}}>Amount</th>
                      {showExp&&<th style={{border:"1px solid #666",padding:"6px 8px",fontSize:10,fontWeight:700,width:90}}>Expiry</th>}
                      </tr></thead>
                    <tbody>
                      {items.map((it:any,i:number)=>(
                        <tr key={it.id||i}>
                          <td style={{border:"1px solid #ddd",padding:"3px 6px"}}><input style={{width:"100%",border:"none",outline:"none",fontSize:10,background:"transparent"}} value={it.productName||""} onChange={(e:any)=>updFn(it.id,"productName",e.target.value)}/></td>
                          <td style={{border:"1px solid #ddd",padding:"3px 6px"}}><input style={{width:"100%",border:"none",outline:"none",fontSize:10,background:"transparent",fontFamily:"monospace"}} value={it.hsCode||""} onChange={(e:any)=>updFn(it.id,"hsCode",e.target.value)}/></td>
                          <td style={{border:"1px solid #ddd",padding:"3px 6px",textAlign:"right"}}><input style={{width:50,border:"none",outline:"none",fontSize:10,background:"transparent",textAlign:"right"}} type="number" value={it.quantity||""} onChange={(e:any)=>updFn(it.id,"quantity",e.target.value)}/></td>
                          <td style={{border:"1px solid #ddd",padding:"3px 6px",textAlign:"right"}}><input style={{width:70,border:"none",outline:"none",fontSize:10,background:"transparent",textAlign:"right"}} type="number" value={it.unitPrice||""} onChange={(e:any)=>updFn(it.id,"unitPrice",e.target.value)}/></td>
                          <td style={{border:"1px solid #ddd",padding:"3px 6px",textAlign:"right",fontSize:10}}>{docCur} {fmt(Number(it.quantity||0)*Number(it.unitPrice||0),docCur)}</td>
                          {showExp&&<td style={{border:"1px solid #ddd",padding:"3px 6px"}}><input type="text" placeholder="YYYY/MM" style={{width:72,border:"none",outline:"none",fontSize:9,background:"transparent"}} value={fmtExpiry(it.expiryDate||"")} onChange={(e:any)=>updFn(it.id,"expiryDate",e.target.value)}/></td>}
                          <td style={{border:"1px solid #ddd",padding:"2px",textAlign:"center"}} className="no-print"><button onClick={()=>delFn(it.id)} style={{border:"none",background:"#fee2e2",color:"#dc2626",cursor:"pointer",borderRadius:3,padding:"1px 5px",fontSize:10}}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr><td colSpan={showExp?6:5} style={{padding:"8px",textAlign:"right",fontWeight:700,fontSize:12,borderTop:"2px solid #000"}}>
                        TOTAL: {docCur} {fmt(items.reduce((s:number,it:any)=>s+(Number(it.quantity||0)*Number(it.unitPrice||0)),0),docCur)}
                      </td></tr>
                    </tfoot>
                  </table>
                  <div className="no-print" style={{marginTop:6}}>
                    <button onClick={addFn} style={{fontSize:11,border:"1px dashed #ccc",background:"#f9f9f9",padding:"4px 10px",borderRadius:4,cursor:"pointer",color:"#666"}}>＋ 品目追加</button>
                  </div>
                  {remarks!==undefined&&<div style={{marginTop:10}}>
                    <div style={{fontSize:9,fontWeight:600,color:"#666",marginBottom:3,textTransform:"uppercase"}}>Remarks</div>
                    <textarea className="no-print" style={{width:"100%",fontSize:10,border:"1px solid #eee",borderRadius:3,padding:"4px 6px",resize:"vertical",minHeight:36}} value={remarks} onChange={(e:any)=>setRemarks(e.target.value)}/>
                    <div className="print-only" style={{fontSize:10,whiteSpace:"pre-wrap"}}>{remarks}</div>
                  </div>}
                </>
              );
            return(
              <>
                {activeDoc==="proforma"&&(
                  <div style={{background:"#fff",width:794,margin:"0 auto",padding:"40px 50px",fontSize:11,color:"#000",minHeight:1123,boxSizing:"border-box" as any,position:"relative" as any}}>
                    <InvoiceHeader title="PROFORMA INVOICE"/>
                    {editTable(invoiceItems,updInvItem,delInvItem,addInvItem,showExp,invoiceRemarks,setInvoiceRemarks,cur)}
                {org?.bankName&&(
                  <div style={{marginTop:16,fontSize:9,border:"1px solid #ddd",padding:8,borderRadius:4}}>
                    <div style={{fontSize:8,fontWeight:700,textTransform:"uppercase" as any,color:"#666",marginBottom:6}}>Banking Information / 銀行口座情報</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      {org.bankName&&<div><span style={{color:"#666"}}>Bank: </span>{org.bankName}</div>}
                      {org.bankBranch&&<div><span style={{color:"#666"}}>Branch: </span>{org.bankBranch}</div>}
                      {org.bankAddress&&<div style={{gridColumn:"1/-1"}}><span style={{color:"#666"}}>Bank Address: </span>{org.bankAddress}</div>}
                      {org.accountNo&&<div><span style={{color:"#666"}}>Account No: </span>{org.accountNo}</div>}
                      {org.swiftCode&&<div><span style={{color:"#666"}}>SWIFT: </span>{org.swiftCode}</div>}
                    </div>
                  </div>
                )}
                    <SignatureSection/>
                  </div>
                )}
                {activeDoc==="invoice"&&(
                  <div style={{background:"#fff",width:794,margin:"0 auto",padding:"40px 50px",fontSize:11,color:"#000",minHeight:1123,boxSizing:"border-box" as any,position:"relative" as any}}>
                    <InvoiceHeader title="INVOICE"/>
                    {editTable(invoiceItems,updInvItem,delInvItem,addInvItem,showExp,invoiceRemarks,setInvoiceRemarks,cur)}
                {org?.bankName&&(
                  <div style={{marginTop:16,fontSize:9,border:"1px solid #ddd",padding:8,borderRadius:4}}>
                    <div style={{fontSize:8,fontWeight:700,textTransform:"uppercase" as any,color:"#666",marginBottom:6}}>Banking Information / 銀行口座情報</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      {org.bankName&&<div><span style={{color:"#666"}}>Bank: </span>{org.bankName}</div>}
                      {org.bankBranch&&<div><span style={{color:"#666"}}>Branch: </span>{org.bankBranch}</div>}
                      {org.bankAddress&&<div style={{gridColumn:"1/-1"}}><span style={{color:"#666"}}>Bank Address: </span>{org.bankAddress}</div>}
                      {org.accountNo&&<div><span style={{color:"#666"}}>Account No: </span>{org.accountNo}</div>}
                      {org.swiftCode&&<div><span style={{color:"#666"}}>SWIFT: </span>{org.swiftCode}</div>}
                    </div>
                  </div>
                )}
                    <SignatureSection/>
                  </div>
                )}
                {activeDoc==="commercial"&&(
                  <div style={{background:"#fff",width:794,margin:"0 auto",padding:"40px 50px",fontSize:11,color:"#000",minHeight:1123,boxSizing:"border-box" as any,position:"relative" as any}}>
                    <InvoiceHeader title="COMMERCIAL INVOICE"/>
                    {editTable(commercialItems,updComItem,delComItem,addComItem,showExp,commercialRemarks,setCommercialRemarks,cur)}
                {org?.bankName&&(
                  <div style={{marginTop:16,fontSize:9,border:"1px solid #ddd",padding:8,borderRadius:4}}>
                    <div style={{fontSize:8,fontWeight:700,textTransform:"uppercase" as any,color:"#666",marginBottom:6}}>Banking Information / 銀行口座情報</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      {org.bankName&&<div><span style={{color:"#666"}}>Bank: </span>{org.bankName}</div>}
                      {org.bankBranch&&<div><span style={{color:"#666"}}>Branch: </span>{org.bankBranch}</div>}
                      {org.bankAddress&&<div style={{gridColumn:"1/-1"}}><span style={{color:"#666"}}>Bank Address: </span>{org.bankAddress}</div>}
                      {org.accountNo&&<div><span style={{color:"#666"}}>Account No: </span>{org.accountNo}</div>}
                      {org.swiftCode&&<div><span style={{color:"#666"}}>SWIFT: </span>{org.swiftCode}</div>}
                    </div>
                  </div>
                )}
                    <SignatureSection/>
                  </div>
                )}
                {activeDoc==="packing"&&(
                              <div style={{background:"#fff",width:794,margin:"0 auto",padding:"40px 50px",fontSize:11,color:"#000",minHeight:1123,boxSizing:"border-box" as any}}>
              {packingPages.map((pageRows,pi)=>(
                <div key={pi} className={pi<packingPages.length-1?"pdf-page":""}>
                  <PackingHeader/>
                  <table style={{width:"100%",borderCollapse:"collapse",marginTop:12}}>
                    <thead><tr style={{borderBottom:"2px solid #000"}}>
                      <th style={{border:"1px solid #666",padding:"6px 8px",fontSize:10,fontWeight:700,width:80,textAlign:"center"}}>{printLang==="en"?"Carton No":"番号"}</th>
                      <th style={{border:"1px solid #666",padding:"6px 8px",fontSize:10,fontWeight:700}}>{printLang==="en"?"Description":"商品 & 詳細"}</th>
                      <th style={{border:"1px solid #666",padding:"6px 8px",fontSize:10,fontWeight:700,textAlign:"right",width:60}}>Qty</th>
                      <th style={{border:"1px solid #666",padding:"6px 8px",fontSize:10,fontWeight:700,textAlign:"right",width:80}}>{printLang==="en"?"G.W.(kg)":"総重量(kg)"}</th>
                      <th style={{border:"1px solid #666",padding:"6px 8px",fontSize:10,fontWeight:700,textAlign:"right",width:80}}>{printLang==="en"?"N.W.(kg)":"正味重量(kg)"}</th>
                      <th style={{border:"1px solid #666",padding:"6px 8px",fontSize:10,fontWeight:700,width:100}}>Dimensions(cm)</th>
                      {packingRows.some((r:any)=>(r.lines||[]).some((l:any)=>l.expiryDate))&&<th style={{border:"1px solid #666",padding:"6px 8px",fontSize:10,fontWeight:700}}>{printLang==="en"?"Expiry":"賞味/使用期限"}</th>}
                    </tr></thead>
                    <tbody>
                      {pageRows.map((row:any,i:number)=>{
              const lines=row.lines||[];
              const rowspan=lines.length||1;
              const hasExpiry=packingRows.some((r:any)=>(r.lines||[]).some((l:any)=>l.expiryDate));
              if(lines.length===0) return(
                <tr key={i}>
                  <td style={{border:"1px solid #ccc",padding:"4px 6px",textAlign:"center"}}>{row.cartonNo}</td>
                  <td style={{border:"1px solid #ccc",padding:"4px 6px"}}></td>
                  <td style={{border:"1px solid #ccc",padding:"4px 6px",textAlign:"right"}}></td>
                  <td style={{border:"1px solid #ccc",padding:"4px 6px",textAlign:"right"}}>{row.grossWeight}</td>
                  <td style={{border:"1px solid #ccc",padding:"4px 6px",textAlign:"right"}}>{row.netWeight}</td>
                  <td style={{border:"1px solid #ccc",padding:"4px 6px"}}>{row.dimensions}</td>
                  {hasExpiry&&<td style={{border:"1px solid #ccc",padding:"4px 6px"}}></td>}
                </tr>
              );
              return lines.map((line:any,li:number)=>(
                <tr key={`${i}-${li}`}>
                  {li===0&&<td rowSpan={rowspan} style={{border:"1px solid #ccc",padding:"4px 6px",textAlign:"center",verticalAlign:"middle"}}>{row.cartonNo}</td>}
                  <td style={{border:"1px solid #ccc",padding:"4px 6px"}}>{line.productName}</td>
                  <td style={{border:"1px solid #ccc",padding:"4px 6px",textAlign:"right"}}>{line.quantity}</td>
                  {li===0&&<td rowSpan={rowspan} style={{border:"1px solid #ccc",padding:"4px 6px",textAlign:"right",verticalAlign:"mi
                    </tbody>
                    {pi===packingPages.length-1&&(
                      <tfoot>
                        <tr style={{fontWeight:700,borderTop:"2px solid #000"}}>
                          <td style={{border:"1px solid #ccc",padding:"4px 6px"}}>TOTAL</td>
                          <td style={{border:"1px solid #ccc",padding:"4px 6px"}}></td>
                          <td style={{border:"1px solid #ccc",padding:"4px 6px",textAlign:"right"}}>{packingRows.reduce((s:number,r:any)=>s+(r.lines||[]).reduce((ls:number,l:any)=>ls+(Number(l.quantity)||0),0),0)}</td>
                          <td style={{border:"1px solid #ccc",padding:"4px 6px",textAlign:"right"}}>{packing.reduce((s:number,c:any)=>s+Number(c.grossWeight||0),0).toFixed(2)}</td>
                          <td style={{border:"1px solid #ccc",padding:"4px 6px",textAlign:"right"}}>{packing.reduce((s:number,c:any)=>s+Number(c.netWeight||0),0).toFixed(2)}</td>
                          <td style={{border:"1px solid #ccc",padding:"4px 6px"}}></td>
                          {packingRows.some((r:any)=>r.expiryDate)&&<td style={{border:"1px solid #ccc",padding:"4px 6px"}}></td>}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  {pi===packingPages.length-1&&<SignatureSection/>}
                  {pi<packingPages.length-1&&<div style={{textAlign:"right",fontSize:9,color:"#999",marginTop:6}}>Page {pi+1} / {packingPages.length}</div>}
                </div>
              ))}
            </div>
                )}{activeDoc==="delivery"&&(
  <div style={{background:"#fff",width:794,margin:"0 auto",padding:"40px 50px",fontSize:11,color:"#000",minHeight:1123,boxSizing:"border-box" as any}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
      <div>
        <div style={{fontSize:32,fontWeight:800,letterSpacing:2,lineHeight:1.1,marginBottom:4}}>DELIVERY NOTE</div>
        {invoice.invoiceNo&&<div style={{fontSize:11,color:"#444"}}>No. <strong>{invoice.invoiceNo}</strong></div>}
        {invoice.date&&<div style={{fontSize:11,color:"#444"}}>Ship Date: <strong>{invoice.date}</strong></div>}
      </div>
      <div style={{textAlign:"right",fontSize:10}}>
        {org?.logoBase64&&<img src={org.logoBase64} alt="logo" style={{maxHeight:60,maxWidth:200,objectFit:"contain",marginBottom:4,display:"block",marginLeft:"auto"}}/>}
        {org?.companyName&&<div style={{fontWeight:700,fontSize:12}}>{org.companyName}</div>}
        {org?.address&&<div style={{whiteSpace:"pre-wrap"}}>{org.address}</div>}
        {org?.remarks&&<div style={{whiteSpace:"pre-wrap",marginTop:4,textAlign:"right"}}>{org.remarks}</div>}
        {org?.tel&&<div>Tel: {org.tel}</div>}
      </div>
    </div>
    <div style={{height:2,background:"#000",marginBottom:16}}></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
      <div>
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase" as any,color:"#555",marginBottom:4}}>CONSIGNEE</div>
        <div style={{fontWeight:700,fontSize:12,marginBottom:2}}>{invoice.consignee?.split("\n")[0]||""}</div>
        <div style={{whiteSpace:"pre-wrap",fontSize:10,color:"#333"}}>{invoice.consignee?.split("\n").slice(1).join("\n")||""}</div>
      </div>
      <div style={{fontSize:11}}>
        {invoice.poNumber&&<div style={{marginBottom:4}}><span style={{color:"#666"}}>P.O. No: </span><strong>{invoice.poNumber}</strong></div>}
        {invoice.paymentDue&&<div style={{marginBottom:4}}><span style={{color:"#666"}}>Payment Due: </span>{invoice.paymentDue}</div>}
        {invoice.incoterms&&<div style={{marginBottom:4}}><span style={{color:"#666"}}>Incoterms: </span>{invoice.incoterms}</div>}
        {invoice.shippingMethod&&<div style={{marginBottom:4}}><span style={{color:"#666"}}>Shipping: </span>{invoice.shippingMethod}</div>}
      </div>
    </div>
    {/* 品目テーブル（編集可） */}
    <table style={{width:"100%",borderCollapse:"collapse",marginTop:12}}>
      <thead><tr style={{background:"#222",color:"#fff"}}>
        <th style={{border:"1px solid #444",padding:"6px 8px",fontSize:10,fontWeight:600,textAlign:"left"}}>Description</th>
        <th style={{border:"1px solid #444",padding:"6px 8px",fontSize:10,fontWeight:600,textAlign:"right",width:50}}>Qty</th>
        <th style={{border:"1px solid #444",padding:"6px 8px",fontSize:10,fontWeight:600,textAlign:"right",width:90}}>Unit Price</th>
        <th style={{border:"1px solid #444",padding:"6px 8px",fontSize:10,fontWeight:600,textAlign:"right",width:100}}>Amount</th>
        <th style={{border:"1px solid #444",padding:"6px 8px",fontSize:10,fontWeight:600,width:80}}>Lot No.</th>
        <th style={{border:"1px solid #444",padding:"6px 8px",fontSize:10,fontWeight:600,width:80}}>Expiry</th>
        <th style={{border:"none",width:28}} className="no-print"></th>
      </tr></thead>
      <tbody>
        {invoiceItems.map((it:any,i:number)=>(
          <tr key={it.id||i} style={{background:i%2===0?"#fff":"#fafafa"}}>
            <td style={{border:"1px solid #ddd",padding:"3px 6px"}}><input style={{width:"100%",border:"none",outline:"none",fontSize:10,background:"transparent"}} value={it.productName||""} onChange={(e:any)=>updInvItem(it.id,"productName",e.target.value)}/></td>
            <td style={{border:"1px solid #ddd",padding:"3px 6px",textAlign:"right"}}><input style={{width:45,border:"none",outline:"none",fontSize:10,background:"transparent",textAlign:"right"}} type="number" value={it.quantity||""} onChange={(e:any)=>updInvItem(it.id,"quantity",e.target.value)}/></td>
            <td style={{border:"1px solid #ddd",padding:"3px 6px",textAlign:"right"}}><input style={{width:80,border:"none",outline:"none",fontSize:10,background:"transparent",textAlign:"right"}} type="number" value={it.unitPrice||""} onChange={(e:any)=>updInvItem(it.id,"unitPrice",e.target.value)}/></td>
            <td style={{border:"1px solid #ddd",padding:"3px 6px",textAlign:"right",fontSize:10}}>{cur} {fmt(Number(it.quantity||0)*Number(it.unitPrice||0),cur)}</td>
            <td style={{border:"1px solid #ddd",padding:"3px 6px"}}><input style={{width:"100%",border:"none",outline:"none",fontSize:10,background:"transparent"}} value={it.lotNo||""} onChange={(e:any)=>updInvItem(it.id,"lotNo",e.target.value)}/></td>
            <td style={{border:"1px solid #ddd",padding:"3px 6px"}}><input style={{width:"100%",border:"none",outline:"none",fontSize:10,background:"transparent"}} value={fmtExpiry(it.expiryDate||"")} placeholder="YYYY/MM" onChange={(e:any)=>updInvItem(it.id,"expiryDate",e.target.value)}/></td>
            <td style={{border:"1px solid #ddd",padding:"2px",textAlign:"center"}} className="no-print"><button onClick={()=>delInvItem(it.id)} style={{border:"none",background:"#fee2e2",color:"#dc2626",cursor:"pointer",borderRadius:3,padding:"1px 5px",fontSize:10}}>✕</button></td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr><td colSpan={3} style={{padding:"8px",textAlign:"right",fontWeight:700,fontSize:12,borderTop:"2px solid #000"}}>TOTAL</td>
        <td style={{padding:"8px",fontWeight:700,fontSize:12,borderTop:"2px solid #000",textAlign:"right"}}>{cur} {fmt(invoiceItems.reduce((s:number,it:any)=>s+(Number(it.quantity||0)*Number(it.unitPrice||0)),0),cur)}</td>
        <td colSpan={3} style={{borderTop:"2px solid #000"}}></td></tr>
      </tfoot>
    </table>
    <div className="no-print" style={{marginTop:6}}>
      <button onClick={addInvItem} style={{fontSize:11,border:"1px dashed #ccc",background:"#f9f9f9",padding:"4px 10px",borderRadius:4,cursor:"pointer",color:"#666"}}>＋ 品目追加</button>
    </div>
    {invoiceRemarks&&<div style={{marginTop:12}}>
      <div style={{fontSize:9,fontWeight:600,color:"#666",marginBottom:3,textTransform:"uppercase" as any}}>REMARKS</div>
      <div style={{fontSize:10,whiteSpace:"pre-wrap"}} className="print-only">{invoiceRemarks}</div>
      <textarea className="no-print" style={{width:"100%",fontSize:10,border:"1px solid #eee",borderRadius:3,padding:"4px 6px",resize:"vertical" as any,minHeight:36}} value={invoiceRemarks} onChange={(e:any)=>setInvoiceRemarks(e.target.value)}/>
    </div>}
    {!invoiceRemarks&&<div className="no-print" style={{marginTop:12}}>
      <div style={{fontSize:9,fontWeight:600,color:"#666",marginBottom:3,textTransform:"uppercase" as any}}>REMARKS</div>
      <textarea style={{width:"100%",fontSize:10,border:"1px solid #eee",borderRadius:3,padding:"4px 6px",resize:"vertical" as any,minHeight:36}} value={invoiceRemarks} onChange={(e:any)=>setInvoiceRemarks(e.target.value)}/>
    </div>}
    <div style={{marginTop:40,display:"flex",justifyContent:"flex-end"}}>
      <div style={{textAlign:"center",minWidth:200}}>
        {org?.signatureBase64?<img src={org.signatureBase64} alt="signature" style={{height:50,objectFit:"contain" as any,marginBottom:4}}/>:<div style={{height:50,borderBottom:"1px solid #000",marginBottom:4}}></div>}
        <div style={{fontSize:10,fontWeight:600}}>{org?.signerName?`Authorized by ${org.signerName}, ${org.companyName||""}`:""}</div>
      </div>
    </div>
  </div>
)}
              </>
            );
          })()}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between"}} className="no-print">
        <button className="btn btn-secondary" onClick={onBack}>← ④ Packing List に戻る</button>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-amber btn-sm" onClick={()=>onSave("in_progress")}>💾 保存</button>
          <button className="btn btn-primary" onClick={onNext}>⑥ 承認申請へ →</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HISTORY PAGE
// ============================================================
function HistoryPage({onLoad,onCopy,onConvert,onEdit}:any){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [filterStatus,setFilterStatus]=useState("all");
  const statusLabel:any={draft:"下書き",in_progress:"作業中",pending_approval:"承認待ち",approved:"承認済み",rejected:"差戻し",completed:"完了"};

  const fetch=useCallback(async()=>{
    setLoading(true);
    try{const d=await sb("invoices?order=created_at.desc");setItems(d||[]);}
    catch(e){console.error(e);}
    setLoading(false);
  },[]);

  useEffect(()=>{fetch();},[fetch]);

  const del=async(id:string,e:any)=>{
    e.stopPropagation();
    if(!confirm("削除しますか？"))return;
    await sb(`invoices?id=eq.${id}`,{method:"DELETE"});
    fetch();
  };

  const filtered=items.filter(h=>{
    const q=search.toLowerCase();
    const mq=!q||(h.invoice_no||"").toLowerCase().includes(q)||(h.consignee||"").toLowerCase().includes(q)||(h.country_of_origin||"").toLowerCase().includes(q);
    const ms=filterStatus==="all"||h.status===filterStatus||h.approval_status===filterStatus;
    return mq&&ms;
  });

  return(
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <div className="card-title">📚 保存済み案件一覧</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["all","draft","pending_approval","approved","in_progress","completed"].map(s=>(
              <button key={s} className={`btn btn-xs ${filterStatus===s?"btn-primary":"btn-secondary"}`} onClick={()=>setFilterStatus(s)}>
                {s==="all"?"全て":statusLabel[s]||s}
              </button>
            ))}
          </div>
        </div>
        <input className="input" placeholder="🔍 Invoice No・得意先・国で検索..." value={search} onChange={(e:any)=>setSearch(e.target.value)} style={{marginBottom:14}}/>
        {loading?<div style={{textAlign:"center",padding:28}}><div className="spinner"/></div>
        :filtered.length===0?<div className="empty-state"><div className="empty-icon">📭</div><div style={{fontSize:13}}>保存済みの案件がありません</div></div>
        :filtered.map(h=>(
          <div key={h.id} className="history-item">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
              <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>onLoad(h)}>
                <strong style={{fontSize:13}}>{h.invoice_no||"No Invoice No"}</strong>
                <span className={`status-badge status-${h.approval_status||h.status||"draft"}`}>● {statusLabel[h.approval_status||h.status||"draft"]}</span>
                {h.invoice_type==="proforma"&&<span className="tag tag-amber">Proforma</span>}
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {h.invoice_type==="proforma"&&(
                  <button className="btn btn-primary btn-xs" onClick={(e)=>{e.stopPropagation();onConvert(h);}}>🔄 ①〜⑦フロー開始</button>
                )}
                {h.invoice_type!=="proforma"&&(
                  <button className="btn btn-secondary btn-xs" onClick={(e)=>{e.stopPropagation();onEdit(h);}}>✏️ 編集</button>
                )}
                <button className="btn btn-secondary btn-xs" onClick={()=>onCopy(h)}>📋 コピー</button>
                <button className="btn btn-danger btn-xs" onClick={(e)=>del(h.id,e)}>削除</button>
              </div>
            </div>
            <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:4,cursor:"pointer"}} onClick={()=>onLoad(h)}>{h.consignee?.split("\n")[0]||"—"}</div>
            <div className="history-meta">
              {h.country_of_origin&&<span className="tag tag-blue">{h.country_of_origin}</span>}
              {h.date&&<span className="tag tag-gray">{h.date}</span>}
              {h.currency&&<span className="tag tag-green">{h.currency}</span>}
              {h.tracking_number&&<span className="tag tag-purple">追跡: {h.tracking_number}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SPECIAL PRICES EDITOR
// ============================================================
function SpecialPricesEditor({prices,currency,onChange}:any){
  const list:any[]=Array.isArray(prices)?prices:[];
  const upd=(idx:number,field:string,val:string)=>{
    const arr=list.map((sp:any,i:number)=>i===idx?{...sp,[field]:val}:sp);
    onChange(arr);
  };
  const add=()=>onChange([...list,{productName:"",unitPrice:"",currency:currency||"JPY"}]);
  const remove=(idx:number)=>onChange(list.filter((_:any,i:number)=>i!==idx));
  return(
    <div style={{marginBottom:10,padding:"10px 14px",background:"var(--purple-light)",borderRadius:"var(--radius-lg)"}}>
      <div style={{fontSize:12,fontWeight:600,color:"var(--purple)",marginBottom:8}}>💰 製品別特別価格（Proforma入力時に自動反映）</div>
      {list.length===0&&<div style={{fontSize:12,color:"var(--text-muted)",marginBottom:6}}>未設定（製品マスタの標準価格が使用されます）</div>}
      {list.map((sp:any,idx:number)=>(
        <div key={idx} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
          <input className="input" style={{flex:2}} placeholder="製品名" value={sp.productName||""} onChange={(e:any)=>upd(idx,"productName",e.target.value)}/>
          <input className="input" style={{flex:1,textAlign:"right" as any}} type="number" placeholder="単価" value={sp.unitPrice||""} onChange={(e:any)=>upd(idx,"unitPrice",e.target.value)}/>
          <select className="input" style={{flex:1}} value={sp.currency||currency||"JPY"} onChange={(e:any)=>upd(idx,"currency",e.target.value)}>
            {["JPY","USD","EUR","GBP","SGD","HKD","AUD","CNY"].map((c:string)=><option key={c}>{c}</option>)}
          </select>
          <button className="btn btn-danger btn-xs" onClick={()=>remove(idx)}>✕</button>
        </div>
      ))}
      <button className="btn btn-secondary btn-xs" style={{marginTop:2}} onClick={add}>＋ 特別価格を追加</button>
    </div>
  );
}

// ============================================================
// CUSTOMER MASTER
// ============================================================
function CustomerPage({onCustomersChange}:any){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState<string|null>(null);
  const empty={name:"",address:"",consignee_name:"",consignee_address:"",country:"Japan",currency:"JPY",incoterms:"",contact:"",email:"",remarks:"",special_prices:[]};
  const [form,setForm]=useState<any>(empty);

  const onCustomersChangeRef=useRef(onCustomersChange);
  useEffect(()=>{onCustomersChangeRef.current=onCustomersChange;},[onCustomersChange]);

  const fetch=useCallback(async()=>{
    setLoading(true);
    try{const d=await sb("customers?order=created_at.desc");setItems(d||[]);onCustomersChangeRef.current(d||[]);}
    catch(e){}
    setLoading(false);
  },[]);

  useEffect(()=>{fetch();},[fetch]);

  const save=async()=>{
    if(!form.name.trim())return alert("会社名を入力してください");
    if(editId){
      await sb(`customers?id=eq.${editId}`,{method:"PATCH",body:JSON.stringify(form)});
    }else{
      await sb("customers",{method:"POST",body:JSON.stringify(form)});
    }
    setForm(empty);setShowForm(false);setEditId(null);fetch();
  };

  const startEdit=(c:any)=>{
    setForm({name:c.name||"",address:c.address||"",consignee_name:c.consignee_name||"",consignee_address:c.consignee_address||"",country:c.country||"Japan",currency:c.currency||"JPY",incoterms:c.incoterms||"",contact:c.contact||"",email:c.email||"",remarks:c.remarks||"",special_prices:c.special_prices||[]});
    setEditId(c.id);setShowForm(true);
  };

  const del=async(id:string)=>{
    if(!confirm("削除しますか？"))return;
    await sb(`customers?id=eq.${id}`,{method:"DELETE"});fetch();
  };

  return(
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">🏢 得意先マスタ</div><div className="card-subtitle">Consignee・Ship Toを登録。Invoice作成時に自動入力。</div></div>
          <button className="btn btn-primary btn-sm" onClick={()=>{setForm(empty);setEditId(null);setShowForm(v=>!v);}}>+ 得意先追加</button>
        </div>
        {showForm&&(
          <div style={{background:"#F7F7F5",borderRadius:"var(--radius-lg)",padding:16,marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{editId?"✏️ 編集":"+ 新規追加"}</div>
            <div className="grid-2" style={{marginBottom:10}}>
              <div className="field"><label className="label"><span className="req">*</span>会社名</label>
                <input className="input" value={form.name} placeholder="ABC Co., Ltd." onChange={(e:any)=>setForm((v:any)=>({...v,name:e.target.value}))}/></div>
              <div className="field"><label className="label">担当者名</label>
                <input className="input" value={form.contact} onChange={(e:any)=>setForm((v:any)=>({...v,contact:e.target.value}))}/></div>
            </div>
            <div className="field" style={{marginBottom:10}}>
              <label className="label">住所（Consignee欄に表示）</label>
              <textarea className="input" rows={2} value={form.address} onChange={(e:any)=>setForm((v:any)=>({...v,address:e.target.value}))}/>
            </div>
            <div style={{fontSize:12,fontWeight:600,color:"var(--blue)",marginBottom:8}}>荷受先（Ship To）情報</div>
            <div className="field" style={{marginBottom:10}}>
              <label className="label">荷受先会社名</label>
              <input className="input" value={form.consignee_name} onChange={(e:any)=>setForm((v:any)=>({...v,consignee_name:e.target.value}))}/>
            </div>
            <div className="field" style={{marginBottom:10}}>
              <label className="label">荷受先住所</label>
              <textarea className="input" rows={2} value={form.consignee_address} onChange={(e:any)=>setForm((v:any)=>({...v,consignee_address:e.target.value}))}/>
            </div>
            <div className="grid-4" style={{marginBottom:10}}>
              <div className="field"><label className="label">国</label>
                <AcInput value={form.country} suggestions={COUNTRIES} placeholder="Japan" onChange={(val:string)=>setForm((v:any)=>({...v,country:val}))}/></div>
              <div className="field"><label className="label">通貨</label>
                <select className="input" value={form.currency} onChange={(e:any)=>setForm((v:any)=>({...v,currency:e.target.value}))}>
                  {CURRENCIES.map((c:string)=><option key={c}>{c}</option>)}</select></div>
              <div className="field"><label className="label">Incoterms</label>
                <select className="input" value={form.incoterms} onChange={(e:any)=>setForm((v:any)=>({...v,incoterms:e.target.value}))}>
                  <option value="">選択</option>{INCOTERMS.map((t:string)=><option key={t}>{t}</option>)}</select></div>
              <div className="field"><label className="label">メール</label>
                <input className="input" value={form.email} onChange={(e:any)=>setForm((v:any)=>({...v,email:e.target.value}))}/></div>
            </div>
            <div className="field" style={{marginBottom:10}}>
              <label className="label">備考（Invoiceに反映）</label>
              <textarea className="input" rows={2} value={form.remarks} placeholder="特記事項" onChange={(e:any)=>setForm((v:any)=>({...v,remarks:e.target.value}))}/>
            </div>
            {/* 特別価格 */}
            <SpecialPricesEditor
              prices={Array.isArray(form.special_prices)?form.special_prices:[]}
              currency={form.currency||"JPY"}
              onChange={(prices:any[])=>setForm((v:any)=>({...v,special_prices:prices}))}
            />
            <div style={{display:"flex",gap:7}}>
              <button className="btn btn-primary btn-sm" onClick={save}>{editId?"更新":"保存"}</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>{setShowForm(false);setEditId(null);setForm(empty);}}>キャンセル</button>
            </div>
          </div>
        )}
        {loading&&items.length===0&&<div style={{textAlign:"center",padding:28}}><div className="spinner"/></div>}
        {!loading&&items.length===0&&<div className="empty-state"><div className="empty-icon">🏢</div><div style={{fontSize:13}}>得意先を登録してください</div></div>}
        {items.map((c:any)=>(
          <div key={c.id} className="history-item">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <strong style={{fontSize:13}}>{c.name}</strong>
              <div style={{display:"flex",gap:5}}>
                <button className="btn btn-secondary btn-xs" onClick={()=>startEdit(c)}>✏️ 編集</button>
                <button className="btn btn-danger btn-xs" onClick={()=>del(c.id)}>削除</button>
              </div>
            </div>
            <div className="history-meta" style={{marginTop:5}}>
              <span className="tag tag-blue">{c.country}</span>
              <span className="tag tag-gray">{c.currency}</span>
              {c.incoterms&&<span className="tag tag-green">{c.incoterms}</span>}
              {c.contact&&<span className="tag tag-amber">{c.contact}</span>}
              {c.email&&<span className="tag tag-purple">{c.email}</span>}
            </div>
            {c.address&&<div style={{fontSize:11,color:"var(--text-muted)",marginTop:3}}>{c.address}</div>}
            {c.consignee_name&&(
              <div style={{marginTop:6,padding:"5px 9px",background:"var(--blue-light)",borderRadius:"var(--radius)",fontSize:11}}>
                <span style={{color:"var(--blue)",fontWeight:600}}>Ship To: </span>{c.consignee_name}
                {c.consignee_address&&<span style={{color:"var(--text-muted)"}}> / {c.consignee_address}</span>}
              </div>
            )}
            {c.remarks&&<div style={{marginTop:5,fontSize:11,color:"var(--text-muted)"}}>備考: {c.remarks}</div>}
            {(c.special_prices||[]).length>0&&(
              <div style={{marginTop:5,fontSize:11,color:"var(--purple)",fontWeight:500}}>
                💰 特別価格: {(c.special_prices||[]).map((sp:any)=>`${sp.productName} → ${sp.currency} ${Number(sp.unitPrice).toLocaleString()}`).join(" / ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// PRODUCT MASTER
// ============================================================
function ProductPage({onProductsChange}:any){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState<string|null>(null);
  const empty={name:"",hs_code:"",unit:"pcs",unit_price:"",currency:"JPY",weight:"",net_weight_per_unit:"",cartons_per_box:"",country_of_origin:"Japan"};
  const [form,setForm]=useState<any>(empty);

  const onProductsChangeRef=useRef(onProductsChange);
  useEffect(()=>{onProductsChangeRef.current=onProductsChange;},[onProductsChange]);

  const fetch=useCallback(async()=>{
    setLoading(true);
    try{const d=await sb("products?order=created_at.desc");setItems(d||[]);if(onProductsChangeRef.current)onProductsChangeRef.current(d||[]);}
    catch(e){}
    setLoading(false);
  },[]);

  useEffect(()=>{fetch();},[fetch]);

  const save=async()=>{
    if(!form.name.trim())return alert("製品名を入力してください");
    const payload={...form,
      unit_price:form.unit_price?Number(form.unit_price):null,
      weight:form.weight?Number(form.weight):null,
      net_weight_per_unit:form.net_weight_per_unit?Number(form.net_weight_per_unit):null,
      cartons_per_box:form.cartons_per_box?Number(form.cartons_per_box):null,
    };
    if(editId){
      await sb(`products?id=eq.${editId}`,{method:"PATCH",body:JSON.stringify(payload)});
    }else{
      await sb("products",{method:"POST",body:JSON.stringify(payload)});
    }
    setForm(empty);setShowForm(false);setEditId(null);fetch();
  };

  const startEdit=(p:any)=>{
    setForm({name:p.name||"",hs_code:p.hs_code||"",unit:p.unit||"pcs",unit_price:p.unit_price||"",currency:p.currency||"JPY",weight:p.weight||"",net_weight_per_unit:p.net_weight_per_unit||"",cartons_per_box:p.cartons_per_box||"",country_of_origin:p.country_of_origin||"Japan"});
    setEditId(p.id);setShowForm(true);
  };

  const del=async(id:string)=>{
    if(!confirm("削除しますか？"))return;
    await sb(`products?id=eq.${id}`,{method:"DELETE"});fetch();
  };

  return(
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">🗂️ 製品マスタ</div><div className="card-subtitle">製品情報を登録。Invoice・Packing List作成時に自動補完。</div></div>
          <button className="btn btn-primary btn-sm" onClick={()=>{setForm(empty);setEditId(null);setShowForm(v=>!v);}}>+ 製品追加</button>
        </div>
        {showForm&&(
          <div style={{background:"#F7F7F5",borderRadius:"var(--radius-lg)",padding:16,marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{editId?"✏️ 編集":"+ 新規追加"}</div>
            <div className="grid-2" style={{marginBottom:10}}>
              <div className="field"><label className="label"><span className="req">*</span>製品名</label>
                <input className="input" value={form.name} onChange={(e:any)=>setForm((v:any)=>({...v,name:e.target.value}))}/></div>
              <div className="field"><label className="label">HSコード（手入力）</label>
                <input className="input" value={form.hs_code} placeholder="例: 2309.90" onChange={(e:any)=>setForm((v:any)=>({...v,hs_code:e.target.value}))}/></div>
            </div>
            <div className="grid-4" style={{marginBottom:10}}>
              <div className="field"><label className="label">単位</label>
                <input className="input" value={form.unit} placeholder="pcs" onChange={(e:any)=>setForm((v:any)=>({...v,unit:e.target.value}))}/></div>
              <div className="field"><label className="label">標準単価</label>
                <input className="input" type="number" value={form.unit_price} onChange={(e:any)=>setForm((v:any)=>({...v,unit_price:e.target.value}))}/></div>
              <div className="field"><label className="label">通貨</label>
                <select className="input" value={form.currency} onChange={(e:any)=>setForm((v:any)=>({...v,currency:e.target.value}))}>
                  {CURRENCIES.map((c:string)=><option key={c}>{c}</option>)}</select></div>
              <div className="field"><label className="label">原産国</label>
                <AcInput value={form.country_of_origin} suggestions={COUNTRIES} placeholder="Japan" onChange={(val:string)=>setForm((v:any)=>({...v,country_of_origin:val}))}/></div>
            </div>
            <div className="grid-3" style={{marginBottom:10}}>
              <div className="field"><label className="label">総重量(kg/個)</label>
                <input className="input" type="number" value={form.weight} placeholder="0.00" onChange={(e:any)=>setForm((v:any)=>({...v,weight:e.target.value}))}/></div>
              <div className="field"><label className="label">正味重量(kg/個)→PL反映</label>
                <input className="input" type="number" value={form.net_weight_per_unit} placeholder="0.00" onChange={(e:any)=>setForm((v:any)=>({...v,net_weight_per_unit:e.target.value}))}/></div>
              <div className="field"><label className="label">1カートン梱包数</label>
                <input className="input" type="number" value={form.cartons_per_box} placeholder="例: 60" onChange={(e:any)=>setForm((v:any)=>({...v,cartons_per_box:e.target.value}))}/></div>
            </div>
            <div style={{display:"flex",gap:7}}>
              <button className="btn btn-primary btn-sm" onClick={save}>{editId?"更新":"保存"}</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>{setShowForm(false);setEditId(null);setForm(empty);}}>キャンセル</button>
            </div>
          </div>
        )}
        {loading?<div style={{textAlign:"center",padding:28}}><div className="spinner"/></div>
        :items.length===0?<div className="empty-state"><div className="empty-icon">🗂️</div><div style={{fontSize:13}}>製品を登録してください</div></div>
        :items.map((p:any)=>(
          <div key={p.id} className="history-item">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <strong style={{fontSize:13}}>{p.name}</strong>
              <div style={{display:"flex",gap:5}}>
                <button className="btn btn-secondary btn-xs" onClick={()=>startEdit(p)}>✏️ 編集</button>
                <button className="btn btn-danger btn-xs" onClick={()=>del(p.id)}>削除</button>
              </div>
            </div>
            <div className="history-meta" style={{marginTop:5}}>
              {p.hs_code&&<span className="tag tag-purple" style={{fontFamily:"monospace"}}>HS: {p.hs_code}</span>}
              <span className="tag tag-gray">{p.unit}</span>
              {p.unit_price&&<span className="tag tag-green">{p.currency} {Number(p.unit_price).toLocaleString()}</span>}
              {p.country_of_origin&&<span className="tag tag-blue">{p.country_of_origin}</span>}
              {p.weight&&<span className="tag tag-amber">総重量 {p.weight}kg</span>}
              {p.net_weight_per_unit&&<span className="tag tag-green">正味 {p.net_weight_per_unit}kg</span>}
              {p.cartons_per_box&&<span className="tag tag-gray">{p.cartons_per_box}個/ctn</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ORG SETTINGS
// ============================================================
function OrgPage({org,setOrg}:any){
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);
  const save=async()=>{
    setSaving(true);
    // localStorageにも保存（fallback）
    localStorage.setItem("tradeOrg",JSON.stringify(org));
    // Supabaseに保存（upsert: id=1 固定行）
    try{
      // まず既存レコードを確認
      const existing=await sb("organization?limit=1").catch(()=>null);
      if(existing&&existing.length>0){
        await sb(`organization?id=eq.${existing[0].id}`,{
          method:"PATCH",
          headers:{"Prefer":"return=representation"},
          body:JSON.stringify({
            company_name:org.companyName||"",address:org.address||"",
            tel:org.tel||"",email:org.email||"",website:org.website||"",
            bank_name:org.bankName||"",bank_branch:org.bankBranch||"",
            bank_address:org.bankAddress||"",account_type:org.accountType||"普通",
            account_no:org.accountNo||"",account_name:org.accountName||"",
            swift_code:org.swiftCode||"",
            signer_name:org.signerName||"",signer_title:org.signerTitle||"",
            logo_base64:org.logoBase64||"",signature_base64:org.signatureBase64||"",
            ship_locations:org.shipLocations||[],
            updated_at:new Date().toISOString(),
          })
        });
      }else{
        await sb("organization",{
          method:"POST",
          headers:{"Prefer":"return=representation"},
          body:JSON.stringify({
            company_name:org.companyName||"",address:org.address||"",
            tel:org.tel||"",email:org.email||"",website:org.website||"",
            bank_name:org.bankName||"",bank_branch:org.bankBranch||"",
            bank_address:org.bankAddress||"",account_type:org.accountType||"普通",
            account_no:org.accountNo||"",account_name:org.accountName||"",
            swift_code:org.swiftCode||"",
            signer_name:org.signerName||"",signer_title:org.signerTitle||"",
            logo_base64:org.logoBase64||"",signature_base64:org.signatureBase64||"",
            ship_locations:org.shipLocations||[],
          })
        });
      }
    }catch(e){console.warn("Supabase org save failed, using localStorage only",e);}
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),2000);
  };
  const f=(key:string,val:any)=>setOrg((v:any)=>({...v,[key]:val}));

  return(
    <div className="fade-in">
      {saved&&<div className="saved-banner">✅ 設定を保存しました（Supabase + ブラウザ）</div>}
      <div className="card">
        <div className="card-header"><div className="card-title">⚙️ 組織設定</div><button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>{saving?<span className="spinner"/>:"💾"} 保存</button></div>

        <div className="org-section-title">ロゴ設定</div>
        <ImgUpload label="会社ロゴ（PDF左上に表示）" value={org.logoBase64||""} onChange={(v:string)=>f("logoBase64",v)} hint="推奨: 横長PNG 300x80px"/>

        <div className="org-section-title">会社情報</div>
        <div className="grid-2" style={{marginBottom:10}}>
          <div className="field"><label className="label">会社名</label>
            <input className="input" value={org.companyName||""} onChange={(e:any)=>f("companyName",e.target.value)}/></div>
          <div className="field"><label className="label">電話番号</label>
            <input className="input" value={org.tel||""} onChange={(e:any)=>f("tel",e.target.value)}/></div>
        </div>
        <div className="field" style={{marginBottom:10}}>
          <label className="label">住所</label>
          <textarea className="input" rows={2} value={org.address||""} onChange={(e:any)=>f("address",e.target.value)}/>
        </div>
        <div className="grid-2" style={{marginBottom:10}}>
          <div className="field"><label className="label">メール</label>
            <input className="input" value={org.email||""} onChange={(e:any)=>f("email",e.target.value)}/></div>
          <div className="field"><label className="label">ウェブサイト</label>
            <input className="input" value={org.website||""} onChange={(e:any)=>f("website",e.target.value)}/></div>
        </div>

        <div className="org-section-title">銀行口座情報（Invoiceに印刷）</div>
        <div className="grid-3" style={{marginBottom:10}}>
          <div className="field"><label className="label">銀行名</label>
            <input className="input" value={org.bankName||""} onChange={(e:any)=>f("bankName",e.target.value)}/></div>
          <div className="field"><label className="label">支店名</label>
            <input className="input" value={org.bankBranch||""} onChange={(e:any)=>f("bankBranch",e.target.value)}/></div>
          <div className="field"><label className="label">口座種別</label>
            <select className="input" value={org.accountType||"普通"} onChange={(e:any)=>f("accountType",e.target.value)}>
              <option>普通</option><option>当座</option><option>Savings</option><option>Current</option>
            </select></div>
        </div>
        <div className="field" style={{marginBottom:10}}>
          <label className="label">銀行住所</label>
          <textarea className="input" rows={2} value={org.bankAddress||""} placeholder="銀行の住所（海外送金時に必要な場合あり）" onChange={(e:any)=>f("bankAddress",e.target.value)}/>
        </div>
        <div className="grid-3" style={{marginBottom:10}}>
          <div className="field"><label className="label">口座番号</label>
            <input className="input" value={org.accountNo||""} onChange={(e:any)=>f("accountNo",e.target.value)}/></div>
          <div className="field"><label className="label">口座名義</label>
            <input className="input" value={org.accountName||""} onChange={(e:any)=>f("accountName",e.target.value)}/></div>
          <div className="field"><label className="label">SWIFTコード</label>
            <input className="input" value={org.swiftCode||""} onChange={(e:any)=>f("swiftCode",e.target.value)}/></div>
        </div>

        <div className="org-section-title">署名・担当者設定（書類右下に表示）</div>
        <div className="grid-2" style={{marginBottom:10}}>
          <div className="field"><label className="label">署名者名</label>
            <input className="input" value={org.signerName||""} onChange={(e:any)=>f("signerName",e.target.value)}/></div>
          <div className="field"><label className="label">役職</label>
            <input className="input" value={org.signerTitle||""} onChange={(e:any)=>f("signerTitle",e.target.value)}/></div>
        </div>
        <ImgUpload label="署名画像（書類右下に表示）" value={org.signatureBase64||""} onChange={(v:string)=>f("signatureBase64",v)} hint="署名をスキャンしてPNG/JPEGで保存してください"/>

        <div className="org-section-title" style={{marginTop:20}}>📍 出荷場所（複数登録可）</div>
        <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:8}}>本社以外の出荷場所を登録できます。Invoice作成時にボタンで選択できます。</div>
        {(org.shipLocations||[]).map((loc:any,i:number)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 2fr 1fr auto",gap:6,marginBottom:6,alignItems:"center"}}>
            <input className="input input-sm" placeholder="場所名（例：大阪倉庫）" value={loc.name||""} onChange={(e:any)=>f("shipLocations",(org.shipLocations||[]).map((l:any,j:number)=>j===i?{...l,name:e.target.value}:l))}/>
            <input className="input input-sm" placeholder="住所" value={loc.address||""} onChange={(e:any)=>f("shipLocations",(org.shipLocations||[]).map((l:any,j:number)=>j===i?{...l,address:e.target.value}:l))}/>
            <input className="input input-sm" placeholder="電話番号" value={loc.tel||""} onChange={(e:any)=>f("shipLocations",(org.shipLocations||[]).map((l:any,j:number)=>j===i?{...l,tel:e.target.value}:l))}/>
            <button className="btn btn-danger btn-xs" onClick={()=>f("shipLocations",(org.shipLocations||[]).filter((_:any,j:number)=>j!==i))}>削除</button>
          </div>
        ))}
        <button className="btn btn-secondary btn-sm" style={{marginBottom:16}} onClick={()=>f("shipLocations",[...(org.shipLocations||[]),{name:"",address:"",tel:""}])}>＋ 出荷場所を追加</button>

        <div style={{marginTop:8}}>
          <button className="btn btn-primary" disabled={saving} onClick={save}>{saving?<span className="spinner"/>:"💾"} 設定を保存（Supabase）</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APPROVAL PAGE
// ============================================================
function ApprovalPage({showToast}:any){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [comment,setComment]=useState<{[id:string]:string}>({});

  const fetch=useCallback(async()=>{
    setLoading(true);
    try{
      const d=await sb("invoices?approval_status=neq.draft&order=created_at.desc");
      setItems(d||[]);
    }catch(e){}
    setLoading(false);
  },[]);

  useEffect(()=>{fetch();},[fetch]);

  const updateStatus=async(id:string,status:string)=>{
    await sb(`invoices?id=eq.${id}`,{method:"PATCH",body:JSON.stringify({approval_status:status,approver_comment:comment[id]||""})});
    showToast(status==="approved"?"✅ 承認しました":"❌ 差し戻しました");
    fetch();
  };

  const statusLabel:any={draft:"下書き",pending_approval:"承認待ち",approved:"承認済み",rejected:"差戻し",in_progress:"作業中",completed:"完了"};

  return(
    <div className="fade-in">
      <div className="card">
        <div className="card-header"><div className="card-title">✅ 承認管理</div></div>
        {loading?<div style={{textAlign:"center",padding:28}}><div className="spinner"/></div>
        :items.length===0?<div className="empty-state"><div className="empty-icon">✅</div><div style={{fontSize:13}}>承認待ちの案件はありません</div></div>
        :items.map((h:any)=>(
          <div key={h.id} style={{padding:"12px 14px",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div>
                <strong style={{fontSize:13}}>{h.invoice_no||"No Invoice No"}</strong>
                <span className={`status-badge status-${h.approval_status||"draft"}`} style={{marginLeft:8}}>
                  {statusLabel[h.approval_status||"draft"]}
                </span>
              </div>
              <div style={{fontSize:11,color:"var(--text-muted)"}}>{new Date(h.created_at).toLocaleDateString("ja-JP")}</div>
            </div>
            <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:8}}>{h.consignee?.split("\n")[0]||"—"} / {h.currency}</div>
            {h.approval_status==="pending_approval"&&(
              <div>
                <div className="field" style={{marginBottom:8}}>
                  <label className="label">コメント（任意）</label>
                  <textarea className="input" rows={2} value={comment[h.id]||""} onChange={(e:any)=>setComment(v=>({...v,[h.id]:e.target.value}))}/>
                </div>
                <div style={{display:"flex",gap:7}}>
                  <button className="btn btn-green btn-sm" onClick={()=>updateStatus(h.id,"approved")}>✅ 承認</button>
                  <button className="btn btn-danger btn-sm" onClick={()=>updateStatus(h.id,"rejected")}>❌ 差し戻し</button>
                </div>
              </div>
            )}
            {h.approver_comment&&<div style={{marginTop:6,fontSize:11,color:"var(--text-muted)"}}>コメント: {h.approver_comment}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// COUNTRY DOCS PAGE
// ============================================================
function CountryDocsPage(){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState<string|null>(null);
  const empty={country:"",documents:["Commercial Invoice","Packing List"],notes:""};
  const [form,setForm]=useState<any>({...empty,documents:[...empty.documents]});
  const [newDoc,setNewDoc]=useState("");
  const [checks,setChecks]=useState<{[k:string]:{[d:string]:boolean}}>({});

  const fetch=useCallback(async()=>{
    setLoading(true);
    try{const d=await sb("country_documents?order=country.asc");setItems(d||[]);}
    catch(e){}
    setLoading(false);
  },[]);

  useEffect(()=>{fetch();},[fetch]);

  const save=async()=>{
    if(!form.country.trim())return alert("国名を入力してください");
    const payload={country:form.country,documents:form.documents,notes:form.notes};
    if(editId){
      await sb(`country_documents?id=eq.${editId}`,{method:"PATCH",body:JSON.stringify(payload)});
    }else{
      await sb("country_documents",{method:"POST",body:JSON.stringify(payload)});
    }
    setForm({...empty,documents:[...empty.documents]});setShowForm(false);setEditId(null);fetch();
  };

  const startEdit=(item:any)=>{
    setForm({country:item.country,documents:[...(item.documents||[])],notes:item.notes||""});
    setEditId(item.id);setShowForm(true);
  };

  const del=async(id:string)=>{
    if(!confirm("削除しますか？"))return;
    await sb(`country_documents?id=eq.${id}`,{method:"DELETE"});fetch();
  };

  const toggleCheck=(country:string,doc:string)=>{
    setChecks(v=>({...v,[country]:{...(v[country]||{}),[doc]:!(v[country]||{})[doc]}}));
  };

  return(
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">🌏 国別必要書類</div><div className="card-subtitle">国ごとに必要書類を登録。輸出前のチェックリストとして使用。</div></div>
          <button className="btn btn-primary btn-sm" onClick={()=>{setForm({...empty,documents:[...empty.documents]});setEditId(null);setShowForm(v=>!v);}}>+ 追加</button>
        </div>
        {showForm&&(
          <div style={{background:"#F7F7F5",borderRadius:"var(--radius-lg)",padding:16,marginBottom:14}}>
            <div className="grid-2" style={{marginBottom:10}}>
              <div className="field"><label className="label"><span className="req">*</span>国名</label>
                <AcInput value={form.country} suggestions={COUNTRIES} placeholder="South Korea" onChange={(val:string)=>setForm((v:any)=>({...v,country:val}))}/></div>
              <div className="field"><label className="label">備考</label>
                <input className="input" value={form.notes} placeholder="特記事項" onChange={(e:any)=>setForm((v:any)=>({...v,notes:e.target.value}))}/></div>
            </div>
            <div className="field" style={{marginBottom:10}}>
              <label className="label">必要書類リスト</label>
              {(form.documents||[]).map((doc:string,i:number)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                  <input className="input" value={doc} onChange={(e:any)=>setForm((v:any)=>({...v,documents:v.documents.map((d:string,j:number)=>j===i?e.target.value:d)}))}/>
                  <button className="btn btn-danger btn-xs" onClick={()=>setForm((v:any)=>({...v,documents:v.documents.filter((_:any,j:number)=>j!==i)}))}>✕</button>
                </div>
              ))}
              <div style={{display:"flex",gap:7,marginTop:6}}>
                <input className="input" value={newDoc} placeholder="書類名を入力" onChange={(e:any)=>setNewDoc(e.target.value)}
                  onKeyDown={(e:any)=>{if(e.key==="Enter"&&newDoc.trim()){setForm((v:any)=>({...v,documents:[...v.documents,newDoc.trim()]}));setNewDoc("");}}}/>
                <button className="btn btn-secondary btn-sm" onClick={()=>{if(newDoc.trim()){setForm((v:any)=>({...v,documents:[...v.documents,newDoc.trim()]}));setNewDoc("");}}}>追加</button>
              </div>
            </div>
            <div style={{display:"flex",gap:7}}>
              <button className="btn btn-primary btn-sm" onClick={save}>{editId?"更新":"保存"}</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>{setShowForm(false);setEditId(null);}}>キャンセル</button>
            </div>
          </div>
        )}
        {loading?<div style={{textAlign:"center",padding:28}}><div className="spinner"/></div>
        :items.length===0?<div className="empty-state"><div className="empty-icon">🌏</div><div style={{fontSize:13}}>国別書類を登録してください</div></div>
        :items.map((item:any)=>(
          <div key={item.id} style={{border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",marginBottom:10,overflow:"hidden"}}>
            <div style={{background:"#FAFAF8",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid var(--border)"}}>
              <div style={{fontWeight:600,fontSize:14}}>🌏 {item.country}</div>
              <div style={{display:"flex",gap:5}}>
                <button className="btn btn-secondary btn-xs" onClick={()=>startEdit(item)}>✏️ 編集</button>
                <button className="btn btn-danger btn-xs" onClick={()=>del(item.id)}>削除</button>
              </div>
            </div>
            <div style={{padding:"10px 14px"}}>
              {item.notes&&<div style={{fontSize:11,color:"var(--amber)",marginBottom:8}}>ℹ️ {item.notes}</div>}
              <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",marginBottom:6}}>チェックリスト</div>
              {(item.documents||[]).map((doc:string,i:number)=>(
                <div key={i} className="checklist-item" style={{cursor:"pointer"}} onClick={()=>toggleCheck(item.country,doc)}>
                  <div className={`check-icon ${(checks[item.country]||{})[doc]?"check-ok":"check-todo"}`}>
                    {(checks[item.country]||{})[doc]?"✓":""}
                  </div>
                  <span style={{fontSize:12,color:(checks[item.country]||{})[doc]?"var(--green)":"var(--text)"}}>{doc}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// INVOICE EDIT STEP (② Invoice編集 / ③ Commercial Invoice編集)
// ============================================================
function InvoiceEditStep({invoice,setInvoice,packing,onBack,onNext,onSave,org,lang,stepNum,title,itemsKey,remarksKey,nextLabel,hint,syncFrom,showToast}:any){
  const t=T[lang||"ja"];
  const cur=invoice.currency||"JPY";

  // itemsKeyが未初期化の場合はitemsから自動引用
  const [localItems,setLocalItems]=useState<any[]>(()=>{
    const existing=invoice[itemsKey];
    if(existing&&existing.length>0)return existing;
    // syncFromがあればそこから引用、なければitemsから引用
    const source=syncFrom&&invoice[syncFrom]&&invoice[syncFrom].length>0
      ?invoice[syncFrom]
      :invoice.items||[];
    return source.map((it:any)=>({...it,id:Date.now()+Math.random()}));
  });
  const [localRemarks,setLocalRemarks]=useState<string>(invoice[remarksKey]||invoice.remarks||"");

  // ローカル変更をinvoiceに反映
  useEffect(()=>{
    setInvoice((v:any)=>({...v,[itemsKey]:localItems,[remarksKey]:localRemarks}));
  },[localItems,localRemarks]);

  const addItem=()=>setLocalItems(v=>[...v,{id:Date.now(),productName:"",quantity:"",unitPrice:"",currency:cur,hsCode:""}]);
  const upd=(id:any,f:string,val:any)=>setLocalItems(v=>v.map((it:any)=>it.id===id?{...it,[f]:val}:it));
  const del=(id:any)=>setLocalItems(v=>v.filter((it:any)=>it.id!==id));
  const total=localItems.reduce((s:number,it:any)=>s+(Number(it.quantity||0)*Number(it.unitPrice||0)),0);

  const syncFromSource=()=>{
    const source=syncFrom&&invoice[syncFrom]&&invoice[syncFrom].length>0
      ?invoice[syncFrom]
      :invoice.items||[];
    setLocalItems(source.map((it:any)=>({...it,id:Date.now()+Math.random()})));
    setLocalRemarks(invoice[syncFrom==="invoice_items"?"invoice_remarks":"remarks"]||invoice.remarks||"");
  };

  const handleNext=()=>{
    setInvoice((v:any)=>({...v,[itemsKey]:localItems,[remarksKey]:localRemarks}));
    onNext();
  };

  return(
    <div className="fade-in">
      <div className="card" style={{background:"var(--blue-light)",border:"1px solid var(--blue-mid)",padding:"12px 18px",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--blue)",marginBottom:4}}>{title}</div>
        <div style={{fontSize:12,color:"var(--blue)"}}>ℹ️ {hint}</div>
        {syncFrom&&(
          <button className="btn btn-secondary btn-sm" style={{marginTop:8}} onClick={syncFromSource}>
            🔄 {stepNum===3?"②Invoice":"Proforma"}から再引用
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div><div className="card-title">品目明細</div><div className="card-subtitle">この書類用に金額・品名を調整できます</div></div>
          <button className="btn btn-primary btn-sm" onClick={addItem}>＋ 品目追加</button>
        </div>
        {localItems.length===0?(
          <div className="empty-state"><div className="empty-icon">📦</div><div style={{fontSize:13}}>品目を追加してください</div></div>
        ):(
          <div style={{overflowX:"auto"}}>
            <table className="items-table">
              <thead><tr>
                <th style={{width:180}}>{t.productName}</th>
                <th style={{width:65}}>{t.qty}</th>
                <th style={{width:90}}>{t.unitPrice}</th>
                <th style={{width:60}}>通貨</th>
                <th style={{width:100}}>{t.hsCode}(任意)</th>
                <th style={{width:90,textAlign:"right"}}>{t.subtotal}</th>
                <th style={{width:32}}></th>
              </tr></thead>
              <tbody>
                {localItems.map((item:any)=>{
                  const ic=item.currency||cur;
                  const sub=Number(item.quantity||0)*Number(item.unitPrice||0);
                  return(
                    <tr key={item.id}>
                      <td><input className="input" value={item.productName||""} onChange={(e:any)=>upd(item.id,"productName",e.target.value)}/></td>
                      <td><input className="input" type="number" value={item.quantity||""} onChange={(e:any)=>upd(item.id,"quantity",e.target.value)}/></td>
                      <td><input className="input" type="number" value={item.unitPrice||""} onChange={(e:any)=>upd(item.id,"unitPrice",e.target.value)}/></td>
                      <td><select className="input" value={ic} onChange={(e:any)=>upd(item.id,"currency",e.target.value)}>
                        {CURRENCIES.map((c:string)=><option key={c}>{c}</option>)}</select></td>
                      <td><input className="input" value={item.hsCode||""} placeholder="任意" onChange={(e:any)=>upd(item.id,"hsCode",e.target.value)}/></td>
                      <td style={{fontWeight:500,fontSize:12,textAlign:"right",paddingRight:6}}>{fmt(sub,ic)}</td>
                      <td><button className="btn btn-danger btn-xs" onClick={()=>del(item.id)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {localItems.length>0&&(
          <div className="total-row">
            <div><div className="total-label">{t.totalAmount}</div><div className="total-value">{cur} {fmt(total,cur)}</div></div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">{t.remarks}</div></div>
        <textarea className="input" value={localRemarks} rows={3} onChange={(e:any)=>setLocalRemarks(e.target.value)}/>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
        <button className="btn btn-secondary" onClick={onBack}>← 前のステップへ</button>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-amber btn-sm" onClick={()=>{setInvoice((v:any)=>({...v,[itemsKey]:localItems,[remarksKey]:localRemarks}));onSave("draft");showToast&&showToast("💾 保存しました");}}>💾 保存</button>
          <button className="btn btn-primary" onClick={handleNext}>{nextLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APPROVAL STEP (⑥ 承認申請→承認)
// ============================================================
function ApprovalStep({invoice,setInvoice,onSave,onBack,onNext,showToast}:any){
  const [comment,setComment]=useState("");
  const approvalStatusLabel:any={draft:"未申請",pending_approval:"承認待ち",approved:"承認済み ✅",rejected:"差し戻し ❌"};
  const st=invoice.approvalStatus||"draft";

  const requestApproval=async()=>{
    if(!invoice.invoiceNo){showToast("Invoice Noを入力してください");return;}
    setInvoice((v:any)=>({...v,approvalStatus:"pending_approval"}));
    await onSave("draft");
    showToast("📨 承認依頼を送信しました");
  };

  const selfApprove=async()=>{
    setInvoice((v:any)=>({...v,approvalStatus:"approved"}));
    await onSave("in_progress");
    showToast("✅ 承認しました");
  };

  const reject=async()=>{
    setInvoice((v:any)=>({...v,approvalStatus:"rejected"}));
    await onSave("draft");
    showToast("❌ 差し戻しました");
  };

  return(
    <div className="fade-in">
      <div className="card">
        <div className="card-header"><div className="card-title">⑥ 承認申請・承認管理</div></div>

        {/* 現在のステータス */}
        <div style={{padding:"14px 18px",background:st==="approved"?"var(--green-light)":st==="rejected"?"var(--red-light)":st==="pending_approval"?"var(--amber-light)":"#F7F7F5",border:`1px solid ${st==="approved"?"var(--green-mid)":st==="rejected"?"var(--red-mid)":st==="pending_approval"?"var(--amber-mid)":"var(--border)"}`,borderRadius:"var(--radius-lg)",marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>承認ステータス</div>
          <div style={{fontSize:20,fontWeight:800}}>{approvalStatusLabel[st]}</div>
          {invoice.invoiceNo&&<div style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>案件: {invoice.invoiceNo}</div>}
        </div>

        {/* 承認フロー表示 */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20,padding:"10px 14px",background:"#FAFAF8",borderRadius:"var(--radius-lg)"}}>
          {[{label:"申請",icon:"📨",status:"pending_approval"},{label:"承認管理ページで承認",icon:"✅",status:"approved"},{label:"⑦出荷へ",icon:"🚢",status:"done"}].map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:20}}>{s.icon}</div>
                <div style={{fontSize:10,color:"var(--text-muted)",marginTop:2}}>{s.label}</div>
              </div>
              {i<2&&<div style={{color:"var(--text-light)"}}>→</div>}
            </div>
          ))}
        </div>

        {st==="draft"&&(
          <div>
            <div style={{fontSize:13,color:"var(--text-muted)",marginBottom:12}}>
              📌 「承認依頼を送信」すると、承認管理ページで上長が承認できます。<br/>
              承認者自身が承認する場合は「自己承認」を使用してください。
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button className="btn btn-purple" onClick={requestApproval}>📨 承認依頼を送信</button>
              <button className="btn btn-green" onClick={selfApprove}>✅ 自己承認（テスト用）</button>
            </div>
          </div>
        )}

        {st==="pending_approval"&&(
          <div>
            <div style={{fontSize:13,color:"var(--amber)",marginBottom:12}}>⏳ 承認待ち中です。承認管理ページで承認してください。</div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-green btn-sm" onClick={selfApprove}>✅ この場で承認</button>
              <button className="btn btn-danger btn-sm" onClick={reject}>❌ 差し戻し</button>
            </div>
          </div>
        )}

        {st==="approved"&&(
          <div>
            <div style={{fontSize:13,color:"var(--green)",marginBottom:16,fontWeight:500}}>✅ 承認済みです。⑦出荷管理へ進んでください。</div>
            <button className="btn btn-green" onClick={onNext}>🚢 ⑦ 出荷管理へ →</button>
          </div>
        )}

        {st==="rejected"&&(
          <div>
            <div style={{fontSize:13,color:"var(--red)",marginBottom:12}}>❌ 差し戻されました。内容を修正して再申請してください。</div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-secondary" onClick={()=>setInvoice((v:any)=>({...v,approvalStatus:"draft"}))}>修正して再申請</button>
            </div>
          </div>
        )}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
        <button className="btn btn-secondary" onClick={onBack}>← ⑤ PDF出力に戻る</button>
        {(st==="approved")&&(
          <button className="btn btn-primary" onClick={onNext}>⑦ 出荷管理へ →</button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TRACKING & PAYMENT PAGE
// ============================================================
function TrackingPage({invoice,setInvoice,onSave,lang,onBack}:any){
  const t=T[lang||"ja"];
  return(
    <div className="fade-in">
      <div className="card">
        <div className="card-header"><div className="card-title">🚚 出荷追跡・入金確認</div></div>
        <div className="grid-2" style={{marginBottom:14}}>
          <div className="field"><label className="label">追跡番号（Tracking Number）</label>
            <input className="input" value={invoice.trackingNumber||""} placeholder="1234567890"
              onChange={(e:any)=>setInvoice((v:any)=>({...v,trackingNumber:e.target.value}))}/></div>
          <div className="field"><label className="label">輸送業者</label>
            <select className="input" value={invoice.shippingMethod||""}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,shippingMethod:e.target.value}))}>
              <option value="">選択</option>
              {SHIPPING_METHODS.map((m:string)=><option key={m}>{m}</option>)}
            </select></div>
        </div>
        <div style={{padding:"12px 16px",background:"var(--green-light)",border:"1px solid var(--green-mid)",borderRadius:"var(--radius-lg)",marginBottom:14}}>
          <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:14,fontWeight:500}}>
            <input type="checkbox" checked={invoice.paymentConfirmed||false}
              onChange={(e:any)=>setInvoice((v:any)=>({...v,paymentConfirmed:e.target.checked}))}
              style={{width:18,height:18}}/>
            💰 入金確認済み
          </label>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"space-between"}}>
          {onBack&&<button className="btn btn-secondary" onClick={onBack}>← ⑥ 承認に戻る</button>}
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-green" onClick={()=>{setInvoice((v:any)=>({...v,status:"completed"}));onSave("completed");}}>
              🚢 出荷完了としてマーク
            </button>
            <button className="btn btn-primary" onClick={()=>onSave(invoice.status||"in_progress")}>
              💾 保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App(){
  const [page,setPage]=useState("new");
  const [step,setStep]=useState(1);
  const [invoice,setInvoice]=useState<any>({...INIT_INVOICE,date:new Date().toISOString().split("T")[0]});
  const [packing,setPacking]=useState<any[]>([]);
  const [customers,setCustomers]=useState<any[]>([]);
  const [products,setProducts]=useState<any[]>([]);
  const [org,setOrg]=useState<any>(INIT_ORG);
  const [toast,setToast]=useState("");
  const [saving,setSaving]=useState(false);
  const [authToken,setAuthToken]=useState<string|null>(null);
  const [authUser,setAuthUser]=useState<any>(null);
  const [authLoading,setAuthLoading]=useState(true);

  const lang=invoice.language||"ja";
  const t=T[lang];

  useEffect(()=>{
    // 起動時にトークンを確認
    const checkAuth=async()=>{
      const token=localStorage.getItem("trade_token");
      if(token){
        const user=await getUser(token);
        if(user){setAuthToken(token);setAuthUser(user);}
        else{localStorage.removeItem("trade_token");}
      }
      setAuthLoading(false);
    };
    checkAuth();
  },[]);

  useEffect(()=>{
    if(!authToken) return;
    // 組織設定をSupabaseから読み込み（localStorageをfallbackに）
    const loadOrg=async()=>{
      try{
        const d=await sb("organization?limit=1");
        if(d&&d.length>0){
          const r=d[0];
          const o={
            companyName:r.company_name||"",address:r.address||"",
            tel:r.tel||"",email:r.email||"",website:r.website||"",
            bankName:r.bank_name||"",bankBranch:r.bank_branch||"",
            bankAddress:r.bank_address||"",accountType:r.account_type||"普通",
            accountNo:r.account_no||"",accountName:r.account_name||"",
            swiftCode:r.swift_code||"",
            signerName:r.signer_name||"",signerTitle:r.signer_title||"",
            logoBase64:r.logo_base64||"",signatureBase64:r.signature_base64||"",
            shipLocations:r.ship_locations||[],
          };
          setOrg(o);
          localStorage.setItem("tradeOrg",JSON.stringify(o));
          return;
        }
      }catch(e){}
      // Supabase失敗時はlocalStorageから
      const saved=localStorage.getItem("tradeOrg");
      if(saved)try{setOrg(JSON.parse(saved));}catch(e){}
    };
    loadOrg();
    sb("customers?order=created_at.desc").then(d=>setCustomers(d||[])).catch(()=>{});
    sb("products?order=created_at.desc").then(d=>setProducts(d||[])).catch(()=>{});
  },[authToken]);

  const showToast=(msg:string)=>setToast(msg);

  const {errors}=useMemo(()=>validate(invoice,packing),[invoice,packing]);

  const reset=useCallback(()=>{
    setOrg((currentOrg:any)=>{
      const defaultShipper=currentOrg?.companyName?[currentOrg.companyName,currentOrg.address,currentOrg.tel?"Tel: "+currentOrg.tel:""].filter(Boolean).join("\n"):"";
      setInvoice({...INIT_INVOICE,date:new Date().toISOString().split("T")[0],shipper:defaultShipper});
      return currentOrg;
    });
    setPacking([]);setStep(1);setPage("new");
  },[]);

  const saveInvoice=async(status="draft")=>{
    setSaving(true);
    try{
      const payload={
        invoice_no:invoice.invoiceNo,invoice_type:invoice.invoiceType||"proforma",
        date:invoice.date,po_number:invoice.poNumber,payment_due:invoice.paymentDue,
        shipper:invoice.shipper,consignee:invoice.consignee,ship_to:invoice.shipTo,
        notify_party:invoice.notifyParty,currency:invoice.currency,incoterms:invoice.incoterms,
        country_of_origin:invoice.countryOfOrigin,shipping_method:invoice.shippingMethod,
        port_of_loading:invoice.portOfLoading,remarks:invoice.remarks,expiry_date:invoice.expiryDate,
        status:status,language:invoice.language||"ja",
        approval_status:invoice.approvalStatus||"draft",
        tracking_number:invoice.trackingNumber||"",
        payment_confirmed:invoice.paymentConfirmed||false,
        items:invoice.items,packing_items:packing,
        invoice_items:invoice.invoice_items||[],
        commercial_items:invoice.commercial_items||[],
        invoice_remarks:invoice.invoice_remarks||"",
        commercial_remarks:invoice.commercial_remarks||"",
      };
      if(invoice.dbId){
        await sb(`invoices?id=eq.${invoice.dbId}`,{method:"PATCH",body:JSON.stringify({...payload,updated_at:new Date().toISOString()})});
      }else{
        const r=await sb("invoices",{method:"POST",body:JSON.stringify(payload)});
        if(r?.[0]?.id)setInvoice((v:any)=>({...v,dbId:r[0].id}));
      }
      showToast(status==="draft"?"💾 下書きを保存しました":"✅ 保存しました");
    }catch(e){showToast("❌ 保存に失敗しました");}
    setSaving(false);
  };

  const requestApproval=async()=>{
    if(!invoice.invoiceNo)return showToast("Invoice Noを入力してください");
    setInvoice((v:any)=>({...v,approvalStatus:"pending_approval"}));
    await saveInvoice("draft");
    setStep(6);
    showToast("📨 承認依頼を送信しました");
  };

  const loadInvoice=(h:any)=>{
    setInvoice({...INIT_INVOICE,
      dbId:h.id,invoiceNo:h.invoice_no||"",invoiceType:h.invoice_type||"proforma",
      date:h.date||"",poNumber:h.po_number||"",paymentDue:h.payment_due||"",
      shipper:h.shipper||"",consignee:h.consignee||"",shipTo:h.ship_to||"",
      notifyParty:h.notify_party||"",currency:h.currency||"JPY",incoterms:h.incoterms||"",
      countryOfOrigin:h.country_of_origin||"",shippingMethod:h.shipping_method||"",
      portOfLoading:h.port_of_loading||"",remarks:h.remarks||"",
      expiryDate:h.expiry_date||"",status:h.status||"draft",
      language:h.language||"ja",approvalStatus:h.approval_status||"draft",
      trackingNumber:h.tracking_number||"",paymentConfirmed:h.payment_confirmed||false,
      items:h.items||[],
      _selectedCustomer:null,
      invoice_items:h.invoice_items||[],
      commercial_items:h.commercial_items||[],
      invoice_remarks:h.invoice_remarks||"",
      commercial_remarks:h.commercial_remarks||"",
    });
    setPacking((h.packing_items||[]).map((c:any)=>({...c,id:c.id||Date.now()+Math.random()})));
    setStep(1);setPage("new");
    showToast("📂 案件を読み込みました");
  };

  const convertToCommercial=(h:any)=>{
    // Proforma → Commercial変換：invoice_itemsをcommercial_itemsの初期値に自動引用
    const baseItems=(h.invoice_items&&h.invoice_items.length>0?h.invoice_items:h.items||[]).map((it:any)=>({...it,id:Date.now()+Math.random()}));
    const newInv={...INIT_INVOICE,
      invoiceNo:h.invoice_no||"",
      invoiceType:"commercial",
      date:new Date().toISOString().split("T")[0],
      poNumber:h.po_number||"",paymentDue:h.payment_due||"",
      shipper:h.shipper||"",consignee:h.consignee||"",shipTo:h.ship_to||"",
      notifyParty:h.notify_party||"",currency:h.currency||"JPY",incoterms:h.incoterms||"",
      countryOfOrigin:h.country_of_origin||"",shippingMethod:h.shipping_method||"",
      portOfLoading:h.port_of_loading||"",remarks:h.remarks||"",
      language:h.language||"ja",approvalStatus:"draft",status:"draft",
      items:(h.items||[]).map((it:any)=>({...it,id:Date.now()+Math.random()})),
      invoice_items:baseItems.map((it:any)=>({...it,id:Date.now()+Math.random()})),
      commercial_items:baseItems.map((it:any)=>({...it,id:Date.now()+Math.random()})),
      invoice_remarks:h.invoice_remarks||h.remarks||"",
      commercial_remarks:h.commercial_remarks||h.remarks||"",
      proformaRef:h.invoice_no||"",
    };
    setInvoice(newInv);
    setPacking((h.packing_items||[]).map((c:any)=>({...c,id:Date.now()+Math.random()})));
    setStep(2);setPage("new"); // ②Invoice編集ステップへ
    showToast("🔄 Commercialに変換しました。② Invoice編集から進めてください。");
  };

  const editInvoice=(h:any)=>{
    loadInvoice(h);
  };

  const copyInvoice=(h:any)=>{
    const newInv={...INIT_INVOICE,
      invoiceNo:"",invoiceType:h.invoice_type||"proforma",
      date:new Date().toISOString().split("T")[0],
      poNumber:"",paymentDue:"",
      shipper:h.shipper||"",consignee:h.consignee||"",shipTo:h.ship_to||"",
      notifyParty:h.notify_party||"",currency:h.currency||"JPY",incoterms:h.incoterms||"",
      countryOfOrigin:h.country_of_origin||"",shippingMethod:h.shipping_method||"",
      portOfLoading:h.port_of_loading||"",remarks:h.remarks||"",
      language:h.language||"ja",approvalStatus:"draft",status:"draft",
      items:(h.items||[]).map((it:any)=>({...it,id:Date.now()+Math.random()})),
    };
    setInvoice(newInv);
    setPacking((h.packing_items||[]).map((c:any)=>({...c,id:Date.now()+Math.random()})));
    setStep(1);setPage("new");
    showToast("📋 前回案件をコピーしました。Invoice Noを変更してください。");
  };

  const navItems=[
    {id:"new",label:t.newDoc,icon:"✏️"},
    {id:"history",label:t.history,icon:"📚"},
    {id:"customers",label:t.customers,icon:"🏢"},
    {id:"products",label:t.products,icon:"🗂️"},
    {id:"approval",label:t.approval,icon:"✅"},
    {id:"countryDocs",label:t.countryDocs,icon:"🌏"},
    {id:"org",label:t.org,icon:"⚙️"},
  ];

  const titles:any={new:t.newDoc,history:t.history,customers:t.customers,products:t.products,approval:t.approval,countryDocs:t.countryDocs,org:t.org};

  // ローディング中
  if(authLoading) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#1a1a2e"}}>
      <div style={{color:"#fff",fontSize:18}}>🌏 読み込み中...</div>
    </div>
  );

  // 未ログイン
  if(!authToken)return(
  <>
    <style>{css}</style>
    <LoginPage onLogin={(token:string,user:any)=>{setAuthToken(token);setAuthUser(user);}}/>
  </>
);
  return(
    <>
      <style>{css}</style>
      {toast&&<Toast msg={toast} onClose={()=>setToast("")}/>}
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-logo">
            {org?.logoBase64?<img src={org.logoBase64} className="logo-img" alt="logo"/>:null}
            <div className="logo-text">🚢 TradeDoc</div>
            <div className="logo-sub">貿易書類管理システム</div>
          </div>
          <nav className="sidebar-nav">
            <div className="nav-label">メニュー</div>
            {navItems.map(n=>(
              <button key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={()=>{
                if(n.id==="new"){reset();}
                else{setPage(n.id);}
              }}>
                <span className="nav-icon">{n.icon}</span>{n.label}
              </button>
            ))}
          </nav>
          <div style={{padding:"8px",borderTop:"1px solid rgba(255,255,255,0.1)",marginTop:"auto"}}>
            {authUser&&<div style={{fontSize:11,color:"rgba(255,255,255,0.5)",padding:"4px 10px",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{authUser.email}</div>}
            <button
              onClick={async()=>{if(authToken)await signOut(authToken);localStorage.removeItem("trade_token");setAuthToken(null);setAuthUser(null);}}
              style={{width:"100%",padding:"8px 10px",background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.8)",border:"none",borderRadius:6,fontSize:12,cursor:"pointer",textAlign:"left" as any}}
            >🚪 ログアウト</button>
          </div>
          {page==="new"&&errors.length>0&&(
            <div className="error-panel">
              <div className="error-panel-title">⚠️ {errors.length}件のエラー</div>
              {errors.slice(0,5).map((e:any,i:number)=>(
                <div key={i} className="error-panel-item" onClick={()=>setStep(e.step||1)}>
                  → {e.msg}
                </div>
              ))}
            </div>
          )}
        </aside>

        <main className="main">
          <div className="topbar">
            <div className="topbar-title">{titles[page]||"TradeDoc"}</div>
            <div className="topbar-actions">
              {page==="new"&&<>
                <button className="btn btn-secondary btn-sm" onClick={reset}>🔄 リセット</button>
                {invoice.invoiceType==="proforma"&&(
                  <button className="btn btn-amber btn-sm" disabled={saving} onClick={()=>saveInvoice("draft")}>
                    {saving?<span className="spinner"/>:"💾"} Proforma保存
                  </button>
                )}
                {invoice.invoiceType!=="proforma"&&step>=1&&step<=5&&(
                  <button className="btn btn-amber btn-sm" disabled={saving} onClick={()=>saveInvoice("draft")}>
                    {saving?<span className="spinner"/>:"💾"} 下書き保存
                  </button>
                )}
                {invoice.invoiceType!=="proforma"&&invoice.approvalStatus==="draft"&&step>=5&&(
                  <button className="btn btn-purple btn-sm" onClick={requestApproval}>📨 ⑥承認依頼</button>
                )}
                <button className="btn btn-green btn-sm" onClick={()=>setPage("history")}>📚 保存済み案件</button>
              </>}
            </div>
          </div>

          <div className="content">
            {page==="new"&&(
              <>
                {invoice.invoiceType==="proforma"?(
                  <div style={{background:"var(--amber-light,#FEF3C7)",border:"1px solid var(--amber,#F59E0B)",borderRadius:"var(--radius)",padding:"8px 16px",marginBottom:12,fontSize:12,color:"#92400E"}}>
                    📋 <strong>Proforma Invoice</strong> 作成モード ― 保存後、一覧から「①〜⑦ Commercialフロー」で進められます
                  </div>
                ):(
                  <div style={{background:"var(--green-light,#D1FAE5)",border:"1px solid #6EE7B7",borderRadius:"var(--radius)",padding:"8px 16px",marginBottom:12,fontSize:12,color:"#065F46"}}>
                    🔄 <strong>統合ワークフロー</strong>: ①Proforma引用 → ②Invoice編集 → ③Commercial編集 → ④Packing → ⑤PDF → ⑥承認 → ⑦出荷
                    {invoice.proformaRef&&<span style={{marginLeft:8,fontWeight:600}}>（Proforma参照: {invoice.proformaRef}）</span>}
                  </div>
                )}
                <StepBar step={step} setStep={setStep} lang={lang} invoiceType={invoice.invoiceType} approvalStatus={invoice.approvalStatus}/>

                {invoice.invoiceType==="proforma"?(
                  <>
                    {step===1&&<InvoiceForm invoice={invoice} setInvoice={setInvoice} onNext={()=>{saveInvoice("draft");setStep(2);}} customers={customers} products={products} org={org} lang={lang}/>}
                    {step>=2&&<div className="card" style={{padding:24,textAlign:"center"}}>
                      <div style={{fontSize:32,marginBottom:12}}>📨</div>
                      <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Proformaを保存しました</div>
                      <div style={{fontSize:13,color:"var(--text-muted)",marginBottom:20}}>保存済み案件から「🔄 Commercialに変換」で①〜⑦フローを開始してください</div>
                      <button className="btn btn-green" onClick={()=>setPage("history")}>📚 保存済み案件を見る</button>
                    </div>}
                  </>
                ):(
                  <>
                    {/* ① Proforma引用確認 */}
                    {step===1&&(
                      <div className="fade-in">
                        <div className="card" style={{padding:20,marginBottom:14,background:"var(--amber-light)",border:"1px solid var(--amber-mid)"}}>
                          <div style={{fontSize:14,fontWeight:700,marginBottom:8,color:"#92400E"}}>① Proforma Invoice 引用元確認</div>
                          {invoice.proformaRef
                            ?<div style={{fontSize:13,color:"#92400E"}}>✅ Proforma <strong>{invoice.proformaRef}</strong> から自動引用済みです</div>
                            :<div style={{fontSize:13,color:"#92400E"}}>⚠️ Proformaからの変換でない場合は②へ進んでください</div>}
                        </div>
                        <InvoiceForm invoice={invoice} setInvoice={setInvoice} onNext={()=>setStep(2)} customers={customers} products={products} org={org} lang={lang}/>
                        <div style={{display:"flex",justifyContent:"flex-end",marginTop:8,gap:8}}>
                          <button className="btn btn-amber" onClick={()=>{saveInvoice("draft");showToast("💾 保存しました");}}>💾 下書き保存</button>
                          <button className="btn btn-primary" onClick={()=>setStep(2)}>② Invoice編集へ →</button>
                        </div>
                      </div>
                    )}

                    {/* ② Invoice編集（金額調整可） */}
                    {step===2&&(
                      <InvoiceEditStep
                        invoice={invoice} setInvoice={setInvoice} packing={packing}
                        onBack={()=>setStep(1)} onNext={()=>setStep(3)}
                        onSave={saveInvoice} org={org} lang={lang} stepNum={2}
                        showToast={showToast}
                        title="② Invoice 作成・編集（金額・品目を調整）"
                        itemsKey="invoice_items" remarksKey="invoice_remarks"
                        nextLabel="③ Commercial Invoice編集へ →"
                        hint="Proformaから自動引用されています。金額・品目を調整してください。"
                      />
                    )}

                    {/* ③ Commercial Invoice編集（通関用） */}
                    {step===3&&(
                      <InvoiceEditStep
                        invoice={invoice} setInvoice={setInvoice} packing={packing}
                        onBack={()=>setStep(2)} onNext={()=>setStep(4)}
                        onSave={saveInvoice} org={org} lang={lang} stepNum={3}
                        showToast={showToast}
                        title="③ Commercial Invoice 編集（通関用・Invoice②から自動引用）"
                        itemsKey="commercial_items" remarksKey="commercial_remarks"
                        nextLabel="④ Packing List作成へ →"
                        hint="Invoice②の内容から自動引用しています。通関用に品名・金額を変更できます。"
                        syncFrom="invoice_items"
                      />
                    )}

                    {/* ④ Packing List */}
                    {step===4&&<PackingForm invoice={invoice} packing={packing} setPacking={setPacking} onNext={()=>{saveInvoice("in_progress");setStep(5);}} onBack={()=>setStep(3)} lang={lang} products={products}/>}

                    {/* ⑤ PDF出力 */}
                    {step===5&&<OutputPage invoice={invoice} packing={packing} onBack={()=>setStep(4)} org={org} lang={lang} onSave={saveInvoice} onNext={()=>setStep(6)}/>}

                    {/* ⑥ 承認申請→承認 */}
                    {step===6&&(
                      <ApprovalStep invoice={invoice} setInvoice={setInvoice} onSave={saveInvoice} onBack={()=>setStep(5)} onNext={()=>setStep(7)} showToast={showToast}/>
                    )}

                    {/* ⑦ 出荷管理 */}
                    {step===7&&<TrackingPage invoice={invoice} setInvoice={setInvoice} onSave={saveInvoice} lang={lang} onBack={()=>setStep(6)}/>}
                  </>
                )}
              </>
            )}
            {page==="history"&&<HistoryPage onLoad={loadInvoice} onCopy={copyInvoice} onConvert={convertToCommercial} onEdit={editInvoice}/>}
            {page==="customers"&&<CustomerPage onCustomersChange={setCustomers}/>}
            {page==="products"&&<ProductPage onProductsChange={setProducts}/>}
            {page==="approval"&&<ApprovalPage showToast={showToast}/>}
            {page==="countryDocs"&&<CountryDocsPage/>}
            {page==="org"&&<OrgPage org={org} setOrg={setOrg}/>}
          </div>
        </main>
      </div>
    </>
  );
}
