function CustomerMasterPage({ customers, setCustomers }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    country: "Japan",
    currency: "JPY",
    incoterms: "",
    contact: "",
    email: "",
    notifyParty: "",
  });

  const save = () => {
    if (!form.name.trim()) return alert("会社名を入力してください");
    setCustomers((v: any[]) => [...v, { id: Date.now(), ...form }]);
    setForm({
      name: "",
      address: "",
      country: "Japan",
      currency: "JPY",
      incoterms: "",
      contact: "",
      email: "",
      notifyParty: "",
    });
    setShowForm(false);
  };

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">🏢 取引先登録</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            + 取引先追加
          </button>
        </div>

        {/* フォーム */}
        {showForm && (
          <div>
            <input
              value={form.name}
              onChange={(e) =>
                setForm((v) => ({ ...v, name: e.target.value }))
              }
            />
            <button onClick={save}>保存</button>
          </div>
        )}

        {/* 一覧 */}
        {customers.map((c: any) => (
          <div key={c.id}>
            <strong>{c.name}</strong>
            <div>{c.address}</div>
          </div>
        ))}
      </div>

      {/* ✅ ここが正解！！（mapの外） */}
      <div style={{ position: "fixed", bottom: 10, right: 10 }}>
        TEST v3
      </div>
    </div>
  );
}