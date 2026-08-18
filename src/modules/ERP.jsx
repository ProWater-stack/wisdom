/* ============================================================================
   modules/ERP.jsx — ERP & Inventory module. Extracted verbatim from App.jsx
   (v2.30 module-split). Purifier asset lifecycle: deployed → repair →
   refurbished → retired, plus straight-line depreciation.
   ============================================================================ */

import { useState, useEffect } from "react";
import { AlertCircle, Boxes, Download, Landmark, TrendingUp, Wallet } from "lucide-react";
import { useAuth, api, exportToCsv, hashStr, inr, deviceType, fmtDate, customerApi } from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, DeviceTypeBadge, SortHeader,
  Stat, Chip, btnGhost, td, ftd, grid4,
} from "../shared/ui";

/* ---- ERP: Asset lifecycle (deployed → repair → refurbished → retired) + depreciation ---- */
const ASSET_STATES = {
  deployed:    ["Deployed",    "#08805A", "#E2F3EE"],
  in_repair:   ["In Repair",   "#986315", "#FBF0E0"],
  refurbished: ["Refurbished", "#2A86D6", "#E5F0FA"],
  retired:     ["Retired",     "#7D8A83", "#ECEEED"],
};
export const DEPRECIATION_MONTHS = 60; // straight-line over 5 years
export function AssetLifecycle() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.logView(user.username, "Viewed Asset lifecycle");
    customerApi.getCustomers().then(setData).catch(e => setErr(e.message || "Could not load assets."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  const now = Date.now();
  const MS_MONTH = 86400000 * 30.44;

  const assets = data.filter(c => c.purifier_id).map(c => {
    const h = hashStr(c.purifier_id);
    // Distribution: mostly deployed, a few in repair / refurbished / retired.
    const bucket = h % 10;
    const state = bucket === 0 ? "retired" : bucket === 1 ? "refurbished" : bucket === 2 ? "in_repair" : "deployed";
    const cost = 8000 + (h % 7000);                       // purchase cost ₹8k–15k
    const start = c.since ? new Date(c.since) : null;
    const ageMonths = start && !isNaN(start.getTime()) ? Math.max(0, (now - start.getTime()) / MS_MONTH) : 0;
    const deprPct = state === "retired" ? 1 : Math.min(ageMonths / DEPRECIATION_MONTHS, 1);
    const depreciation = Math.round(cost * deprPct);
    const bookValue = cost - depreciation;
    return { c, state, cost, depreciation, bookValue, deployed: start };
  });

  const gross = assets.reduce((a, x) => a + x.cost, 0);
  const accDepr = assets.reduce((a, x) => a + x.depreciation, 0);
  const nbv = assets.reduce((a, x) => a + x.bookValue, 0);
  const countBy = (s) => assets.filter(x => x.state === s).length;

  const stats = [
    { label: "Total assets", value: assets.length, icon: Boxes, sub: `${countBy("deployed")} deployed · ${countBy("in_repair")} in repair`, hero: true },
    { label: "Gross asset value", value: inr(gross), icon: Landmark, sub: "purchase cost" },
    { label: "Accumulated depreciation", value: inr(accDepr), icon: TrendingUp, sub: "written off to date" },
    { label: "Net book value", value: inr(nbv), icon: Wallet, sub: "current carrying value" },
  ];

  const stChip = (s) => {
    const [lbl, c, bg] = ASSET_STATES[s] || ["—", "#7D8A83", "#ECEEED"];
    return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{lbl}</span>;
  };

  const ql = q.toLowerCase();
  const shown = assets.filter(x => (filter === "all" || x.state === filter) &&
    (!ql || `${x.c.name} ${x.c.purifier_id} ${x.c.society}`.toLowerCase().includes(ql)));

  const chips = [["all", `All (${assets.length})`], ...Object.keys(ASSET_STATES).map(s => [s, `${ASSET_STATES[s][0]} (${countBy(s)})`])];

  const exportCsv = () => exportToCsv("prowater-asset-lifecycle.csv", [
    { label: "Purifier ID", get: x => x.c.purifier_id },
    { label: "Device Type", get: x => deviceType(x.c.purifier_id) },
    { label: "Location", get: x => x.c.society },
    { label: "Deployed", get: x => x.deployed ? fmtDate(x.deployed) : "" },
    { label: "State", get: x => ASSET_STATES[x.state][0] },
    { label: "Cost", get: x => x.cost },
    { label: "Depreciation", get: x => x.depreciation },
    { label: "Book value", get: x => x.bookValue },
  ], shown);


  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)", background: "var(--mint-2)", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
        <AlertCircle size={15} /> Lifecycle: Deployed → In Repair → Refurbished → Retired. Straight-line depreciation over {DEPRECIATION_MONTHS / 12} years. Values are illustrative until an asset register is connected.
      </div>
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 18 }}>
        <Card title="Purifier asset register" sub="Each deployed unit with its lifecycle state and depreciated book value.">
          <Toolbar q={q} setQ={setQ} placeholder="Search purifier, customer or location…" count={shown.length}
            right={
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {chips.map(([id, lbl]) => (
                  <button key={id} onClick={() => setFilter(id)} style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1.5px solid " + (filter === id ? "var(--teal)" : "var(--border)"), background: filter === id ? "var(--mint-2)" : "#fff", color: filter === id ? "var(--teal-d)" : "var(--slate)" }}>{lbl}</button>
                ))}
                <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
              </div>
            } />
          <Table head={["Purifier", "Device", "Location", "Deployed", "State", "Cost", "Depreciation", "Book value"]} maxHeight={520}>
            {shown.map((x, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid var(--border)", background: x.state === "in_repair" ? "#FBF0E0" : "transparent" }}>
                <td style={{ ...td, textAlign: "center" }}>{x.c.purifier_id ? <Chip>{x.c.purifier_id}</Chip> : "—"}</td>
                <td style={{ ...td, textAlign: "center" }}><DeviceTypeBadge purifierId={x.c.purifier_id} /></td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{x.c.society || "—"}</td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{x.deployed ? fmtDate(x.deployed) : "—"}</td>
                <td style={{ ...td, textAlign: "center" }}>{stChip(x.state)}</td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{inr(x.cost)}</td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>{inr(x.depreciation)}</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 700, color: x.bookValue > 0 ? "var(--teal-d)" : "var(--muted)" }}>{inr(x.bookValue)}</td>
              </tr>
            ))}
            {shown.length > 0 && (
              <tr>
                <td style={{ ...ftd, textAlign: "center" }} colSpan={5}>Total ({shown.length})</td>
                <td style={ftd}>{inr(shown.reduce((a, x) => a + x.cost, 0))}</td>
                <td style={ftd}>{inr(shown.reduce((a, x) => a + x.depreciation, 0))}</td>
                <td style={ftd}>{inr(shown.reduce((a, x) => a + x.bookValue, 0))}</td>
              </tr>
            )}
            {shown.length === 0 && <tr><td colSpan={8} style={{ padding: 0 }}><Empty msg="No assets match this filter." /></td></tr>}
          </Table>
        </Card>
      </div>
    </div>
  );
}
