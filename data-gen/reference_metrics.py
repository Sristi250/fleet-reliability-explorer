"""
Reference implementation of the app's metrics, in plain pandas.

The app computes the same numbers in TypeScript. This script writes
expected_metrics.json so the app's tests can check against an independent
implementation, and prints how far the naive version of each number is from
the correct one.

    python data-gen/reference_metrics.py
"""
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "public" / "data"
OUT = Path(__file__).resolve().parent / "expected_metrics.json"

WINDOW_END = pd.Timestamp("2026-05-31")  # June repairs are still being claimed at extract
MAX_KM_PER_MONTH = 15_000                # faster than any bus runs: a bad reading
LABOUR_RATE_GBP = 45
CORRECTIVE = ["Breakdown", "Driver Defect", "Work Arising"]
DEFINITIONS = {
    "breakdowns": ["Breakdown"],
    "breakdowns_and_driver_defects": ["Breakdown", "Driver Defect"],
    "all_corrective": CORRECTIVE,
}
COMPLAINT_TYPE = [(re.compile(r"failed in service|recovered to depot", re.I), "Breakdown"),
                  (re.compile(r"driver reported", re.I), "Driver Defect"),
                  (re.compile(r"inspection", re.I), "Work Arising")]


def load():
    def read(name, **kw):
        return pd.read_csv(DATA / f"{name}.csv", **kw)

    return dict(
        depots=read("depots", parse_dates=["eam_go_live"]),
        buses=read("buses", dtype={"fleet_number": str}, parse_dates=["in_service_date"]),
        odo=read("odometer_monthly", parse_dates=["reading_date"]),
        parts=read("parts", keep_default_na=False),
        xref=read("operator_part_xref", dtype=str, keep_default_na=False),
        ws=read("workshop_lines", dtype={"fleet_number": str, "operator_part_code": str},
                parse_dates=["wo_date"]),
        wc=read("warranty_claim_lines", dtype={"customer_fleet_ref": str},
                parse_dates=["claim_date", "repair_date"]),
    )


def month_start(s):
    return s.dt.to_period("M").dt.to_timestamp()


def monthly_km(odo, buses):
    """Clean km per bus per month from cumulative odometer readings.

    A reading higher than any later reading is a spike and is dropped. A new
    bus is taken to start at 0 km at the end of the month before it entered
    service. km between two good readings is spread evenly over the months
    between them. A month that still comes out implausibly high (a spike on
    the last reading) gets the bus's median month instead.
    """
    rows = []
    for b in buses.itertuples():
        r = odo[odo.body_number == b.body_number].sort_values("reading_date")
        r = r[r.odometer_km <= r.odometer_km[::-1].cummin()[::-1]]
        start = b.in_service_date.to_period("M").to_timestamp() - pd.Timedelta(days=1)
        prev_date, prev_km = start, 0.0
        for d, km in zip(r.reading_date, r.odometer_km):
            months = pd.period_range(prev_date + pd.Timedelta(days=1), d, freq="M")
            for m in months:
                rows.append((b.body_number, m.to_timestamp(), (km - prev_km) / len(months)))
            prev_date, prev_km = d, km
    km = pd.DataFrame(rows, columns=["body_number", "month", "km"])
    bad = km.km > MAX_KM_PER_MONTH
    median = km[~bad].groupby("body_number").km.median()
    km["imputed"] = bad
    km.loc[bad, "km"] = km.loc[bad, "body_number"].map(median)
    return km


def component_events(t):
    """One row per (work order or claim, component) where a non-consumable
    part was actually consumed: net quantity after returns is above zero."""
    parts = t["parts"].set_index("part_number")
    xref = dict(zip(t["xref"].operator_part_code, t["xref"].part_number))
    fleet_to_body = dict(zip(t["buses"].fleet_number, t["buses"].body_number))

    ws = t["ws"][t["ws"].wo_type.isin(CORRECTIVE)].copy()
    ws["part_number"] = ws.operator_part_code.map(xref).replace("", np.nan)
    ws["component"] = ws.part_number.map(parts.component).fillna("Unmapped operator code")
    ws["consumable"] = ws.part_number.map(parts.is_consumable).eq(True)
    ws["cost"] = ws.qty * ws.part_number.map(parts.list_price_gbp).fillna(0)
    ws = ws[~ws.consumable]
    w = ws.groupby(["wo_ref", "component"], as_index=False).agg(
        date=("wo_date", "first"), fleet_number=("fleet_number", "first"),
        wo_type=("wo_type", "first"), qty=("qty", "sum"), parts_cost=("cost", "sum"),
        wo_hours=("wo_total_hours", "first"))
    w["body_number"] = w.fleet_number.map(fleet_to_body)
    w["source"] = "workshop"
    w = w.rename(columns={"wo_ref": "ref"})

    wc = t["wc"].copy()
    wc["component"] = wc.part_number.map(parts.component)
    wc = wc[~wc.part_number.map(parts.is_consumable).astype(bool)]
    c = wc.groupby(["claim_ref", "component"], as_index=False).agg(
        date=("repair_date", "first"), body_number=("body_number", "first"),
        complaint=("complaint", "first"), qty=("qty", "sum"), parts_cost=("part_cost_gbp", "sum"))
    c["wo_type"] = c.complaint.map(classify_complaint)
    c["source"] = "warranty"
    c = c.rename(columns={"claim_ref": "ref"})

    ev = pd.concat([w, c], ignore_index=True)
    ev = ev[ev.qty > 0].copy()
    ev["month"] = month_start(ev.date)
    return ev


def classify_complaint(text):
    for pattern, wo_type in COMPLAINT_TYPE:
        if pattern.search(text):
            return wo_type
    return "Unclassified"


def add_labour(ev):
    """Hours are booked once per work order; split them over its components.
    Warranty claims carry no hours, so use the component's median."""
    per_wo = ev.groupby("ref").component.transform("size")
    ev["hours"] = ev.wo_hours / per_wo
    single = ev[(ev.source == "workshop") & (per_wo == 1) & ev.wo_hours.notna()]
    median = single.groupby("component").wo_hours.median()
    missing = ev.hours.isna()
    ev.loc[missing, "hours"] = ev.loc[missing, "component"].map(median).fillna(single.wo_hours.median())
    ev["labour_cost"] = ev.hours * LABOUR_RATE_GBP
    return ev


def main():
    t = load()
    buses = t["buses"].merge(t["depots"][["depot", "eam_go_live"]], on="depot")
    km = monthly_km(t["odo"], buses).merge(
        buses[["body_number", "model", "depot", "eam_go_live"]], on="body_number")
    # Only count km where every failure on that bus would have been recorded.
    km["covered"] = (km.month >= km.eam_go_live) & (km.month <= WINDOW_END)
    exposure = km[km.covered]

    ev_all = component_events(t).merge(buses[["body_number", "model", "depot", "eam_go_live"]],
                                       on="body_number", how="left")
    ev = ev_all[(ev_all.month >= ev_all.eam_go_live) & (ev_all.month <= WINDOW_END)].copy()
    ev = add_labour(ev)
    fleet_km = exposure.km.sum()

    mdbf = {}
    for name, types in DEFINITIONS.items():
        n = ev[ev.wo_type.isin(types)].ref.nunique()
        mdbf[name] = dict(events=int(n), km=round(fleet_km), mdbf_km=round(fleet_km / n))
    by_model = {}
    for model, g in exposure.groupby("model"):
        n = ev[ev.model == model].ref.nunique()
        by_model[model] = dict(events=int(n), km=round(g.km.sum()), mdbf_km=round(g.km.sum() / n))

    parts = t["parts"]
    fitted = parts[~parts.is_consumable].groupby("component").models.first().str.split("|")
    fitted["Unmapped operator code"] = ["DD", "SD"]
    comp = ev.groupby("component").agg(events=("ref", "nunique"), parts_cost=("parts_cost", "sum"),
                                       labour_hours=("hours", "sum"), labour_cost=("labour_cost", "sum"))
    comp["km"] = [exposure[exposure.model.isin(fitted[c])].km.sum() for c in comp.index]
    comp["mdbf_km"] = comp.km / comp.events
    comp["total_cost"] = comp.parts_cost + comp.labour_cost
    comp["cost_per_1000km"] = comp.total_cost / comp.km * 1000
    comp = comp.round(2)

    def table(df):
        return [dict(component=c, **{k: (round(v) if k in ("km", "mdbf_km") else v)
                                     for k, v in r.items()}) for c, r in df.iterrows()]

    # Naive versions, for comparison.
    ws, wc = t["ws"], t["wc"]
    naive_km = t["odo"].groupby("body_number").odometer_km.max().sum()
    naive_failures = ws.wo_type.isin(CORRECTIVE).sum() + len(wc)
    once = ws.drop_duplicates("wo_ref").wo_total_hours.sum()
    # Look up by key with map, which keeps wc's row order. Comparing two merge
    # results row by row is unsafe: inner merges reorder rows on pandas < 2.2.
    model_by_ref = wc.customer_fleet_ref.map(buses.set_index("fleet_number").model)
    model_by_body = wc.body_number.map(buses.set_index("body_number").model)
    misattributed = (model_by_ref != model_by_body).mean()
    xref = t["xref"]
    descriptions = xref[xref.part_number != ""].groupby("part_number").operator_description.nunique()

    result = dict(
        window=dict(end=str(WINDOW_END.date()), labour_rate_gbp=LABOUR_RATE_GBP,
                    max_km_per_month=MAX_KM_PER_MONTH),
        fleet=dict(buses=len(buses), km_covered=round(fleet_km), km_all_clean=round(km.km.sum()),
                   imputed_months=int(km.imputed.sum())),
        mdbf=mdbf, mdbf_by_model=by_model,
        top_components_by_events=table(comp.sort_values("events", ascending=False).head(15)),
        top_components_by_cost=table(comp.sort_values("total_cost", ascending=False).head(10)),
        unmapped_share_of_events=round(float((ev.component == "Unmapped operator code").mean()), 4),
        rm_cost=dict(parts_gbp=round(ev.parts_cost.sum(), 2), labour_gbp=round(ev.labour_cost.sum(), 2),
                     warranty_share=round(float(ev[ev.source == "warranty"].parts_cost.sum()
                                                / ev.parts_cost.sum()), 4),
                     per_km_gbp=round(float((ev.parts_cost.sum() + ev.labour_cost.sum()) / fleet_km), 4)),
        naive=dict(
            km_sum_of_max_odometer=round(naive_km),
            corrective_lines=int(naive_failures),
            mdbf_km=round(naive_km / naive_failures),
            mdbf_km_ignoring_eam_coverage=round(km.km.sum() / ev_all.ref.nunique()),
            labour_hours_summed_per_line=round(ws.wo_total_hours.sum(), 1),
            labour_hours_once_per_wo=round(once, 1),
            warranty_lines_wrong_model_via_fleet_ref=round(float(misattributed), 4),
            parts_with_more_than_one_operator_description=int((descriptions > 1).sum()),
        ),
    )
    OUT.write_text(json.dumps(result, indent=2))

    print(f"fleet km in coverage   {fleet_km:>14,.0f}   (all clean km {km.km.sum():,.0f})")
    print(f"naive fleet km         {naive_km:>14,.0f}   <- sum of max odometer, spikes included")
    for name, m in mdbf.items():
        print(f"MDBF {name:30s} {m['mdbf_km']:>8,} km  ({m['events']:,} events)")
    print(f"naive MDBF (lines / raw km)         {result['naive']['mdbf_km']:>8,} km")
    print(f"MDBF ignoring EAM coverage          {result['naive']['mdbf_km_ignoring_eam_coverage']:>8,} km")
    named = comp.drop("Unmapped operator code", errors="ignore").events.sort_values(ascending=False)
    print(f"top 2 / top 10 components share of events: {named.head(2).sum() / named.sum():.0%}"
          f" / {named.head(10).sum() / named.sum():.0%}")
    print(f"labour hours: once per WO {once:,.0f} vs summed per line {ws.wo_total_hours.sum():,.0f}")
    print(f"warranty lines on the wrong model if joined on fleet ref: {misattributed:.0%}")
    print(f"unmapped operator codes: {result['unmapped_share_of_events']:.1%} of failure events")
    print(f"R&M (corrective only) GBP/km: {result['rm_cost']['per_km_gbp']}")
    print("\nTop components by events")
    print(comp.sort_values("events", ascending=False).head(15)[
        ["events", "mdbf_km", "parts_cost", "labour_hours", "cost_per_1000km"]].to_string())
    print("\nTop components by cost")
    print(comp.sort_values("total_cost", ascending=False).head(10)[
        ["events", "mdbf_km", "total_cost", "cost_per_1000km"]].to_string())

    dcu = ev[ev.component == "Door control unit"]
    bad = set(buses.body_number[buses.batch == "KIN-2024-04"])
    trend = dcu.assign(batch=dcu.body_number.isin(bad).map({True: "bad batch", False: "rest"}))
    print("\nDoor control unit failures per quarter")
    print(trend.groupby([trend.date.dt.to_period("Q"), "batch"]).size().unstack(fill_value=0).to_string())


if __name__ == "__main__":
    main()
