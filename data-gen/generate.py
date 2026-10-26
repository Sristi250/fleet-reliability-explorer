"""
Generate the synthetic dataset for the Fleet Reliability & TCO Explorer.

Shapes - fleet size, mileage, work-order mix, how concentrated part usage is,
cost spread - are designed to be realistic for a UK battery-electric bus
fleet. No real identifiers, part numbers, prices, depots or operator names
appear. docs/data.md lists the tables and the data-quality
traps planted on purpose.

    python data-gen/generate.py        # writes public/data/*.csv
"""
from pathlib import Path

import numpy as np
import pandas as pd

from catalogue import (ACCIDENT_COMPONENTS, COMPONENTS, CONSUMABLES, PM_ITEMS,
                       SYMPTOMS, SYMPTOMS_HV, SYSTEMS, TIER)

SEED = 2026
OUT = Path(__file__).resolve().parent.parent / "public" / "data"

DATA_END = pd.Timestamp("2026-06-30")        # workshop and odometer extract date
CLAIMS_EXTRACT = pd.Timestamp("2026-07-10")  # warranty claims submitted up to here

TARGET_FAILURES = 11_000     # part-replacing corrective events, recorded or not
PM_PER_BUS_MONTH = 0.34      # preventive work orders that consume parts
ACCIDENTS = 36
WARRANTY_MONTHS = 24

# Planted storyline: one delivery batch gets a door control unit that fails
# far more often, until a campaign swaps it for a revised part.
BAD_BATCH = ("Kingsway", "2024-04")
BAD_BATCH_FAILURES_PER_BUS_MONTH = 0.15
CAMPAIGN_WINDOW = (pd.Timestamp("2025-05-12"), pd.Timestamp("2025-07-25"))
DCU_REV_B_FROM = pd.Timestamp("2025-05-01")

# depot: (plant code used by the workshop system, operating company,
#         EAM go-live, duty-cycle factor on failure rates)
DEPOTS = {
    "Northgate": ("PL1100", "Kestrel North", "2023-11-01", 1.15),
    "Millbrook": ("PL1200", "Kestrel North", "2024-03-01", 1.00),
    "Riverside": ("PL2100", "Kestrel East", "2023-11-01", 0.95),
    "Eastmoor": ("PL2200", "Kestrel East", "2024-07-01", 0.90),
    "Kingsway": ("PL3100", "Kestrel South", "2024-03-01", 1.05),
    "Harbourside": ("PL3200", "Kestrel South", "2024-11-01", 1.20),
    "Westfield": ("PL3300", "Kestrel South", "2023-11-01", 1.00),
    "Ashcombe": ("PL4100", "Kestrel West", "2025-03-01", 0.85),
    "Castlegate": ("PL5100", "Kestrel Scotland", "2024-07-01", 1.10),
    "Glenholm": ("PL5200", "Kestrel Scotland", "2024-11-01", 1.25),
}
COMPANY_PREFIX = {"Kestrel North": 1, "Kestrel East": 2, "Kestrel South": 3,
                  "Kestrel West": 4, "Kestrel Scotland": 5}

# (depot, model, buses, first delivery month) - each batch arrives over ~6 weeks
BATCHES = [
    ("Northgate", "DD", 24, "2023-03"), ("Northgate", "DD", 24, "2023-09"),
    ("Northgate", "DD", 14, "2025-10"),
    ("Millbrook", "SD", 20, "2023-05"), ("Millbrook", "SD", 18, "2024-02"),
    ("Riverside", "DD", 33, "2023-07"), ("Riverside", "SD", 22, "2023-11"),
    ("Eastmoor", "SD", 22, "2023-10"), ("Eastmoor", "SD", 18, "2024-06"),
    ("Kingsway", "DD", 26, "2024-04"), ("Kingsway", "DD", 22, "2024-09"),
    ("Harbourside", "SD", 34, "2024-03"),
    ("Westfield", "DD", 22, "2023-06"), ("Westfield", "SD", 22, "2024-01"),
    ("Ashcombe", "SD", 30, "2024-08"),
    ("Castlegate", "DD", 24, "2023-12"), ("Castlegate", "DD", 18, "2024-05"),
    ("Castlegate", "DD", 10, "2026-02"),
    ("Glenholm", "SD", 32, "2024-10"),
]

# Stores systems abbreviate and reorder descriptions, so operator text never
# matches the manufacturer's - joining on description does not work.
ABBREV = {"ASSEMBLY": "ASSY", "WHEELCHAIR": "W/CHAIR", "SWITCH": "SW", "BUTTON": "BTN",
          "CONTROL": "CTRL", "DISPLAY": "DISP", "CAMERA": "CAM", "BATTERY": "BATT",
          "COMPRESSOR": "COMP", "CONVERTER": "CONV", "SUSPENSION": "SUSP",
          "EMERGENCY": "EMERG", "HANDLE": "HNDL", "MONITOR": "MON", "MANAGEMENT": "MGMT",
          "CONNECTOR": "CONN", "INSTRUMENT": "INST", "ACTUATOR": "ACT", "CHARGING": "CHRG",
          "COOLANT": "CLNT", "LIGHTING": "LTG", "REPAIR": "RPR", "SECTION": "SECT",
          "PASSENGER": "PSGR"}

WO_PREFIX = {"Breakdown": "Breakdown in service - ", "Driver Defect": "Driver reports ",
             "Work Arising": "Found on inspection: "}
CLAIM_COMPLAINT = {"Breakdown": ["Vehicle failed in service - {s}", "Recovered to depot - {s}"],
                   "Driver Defect": ["Driver reported {s}"],
                   "Work Arising": ["Found at inspection - {s}"]}

rng = np.random.default_rng(SEED)


def day_between(start, end):
    return start + pd.Timedelta(days=int(rng.integers(0, (end - start).days + 1)))


def month_end(ts):
    return ts + pd.offsets.MonthEnd(0)


def build_buses():
    rows = []
    for depot, model, n, month in BATCHES:
        start = pd.Timestamp(month + "-01")
        for _ in range(n):
            delivery = start + pd.Timedelta(days=int(rng.integers(0, 42)))
            rows.append(dict(depot=depot, model=model, batch=f"{depot[:3].upper()}-{month}",
                             bad_batch=(depot, month) == BAD_BATCH, delivery_date=delivery,
                             in_service_date=delivery + pd.Timedelta(days=int(rng.integers(7, 30)))))
    buses = pd.DataFrame(rows).sort_values("delivery_date", kind="stable").reset_index(drop=True)
    buses["body_number"] = [f"B{30101 + i}" for i in range(len(buses))]
    buses["operating_company"] = buses.depot.map(lambda d: DEPOTS[d][1])
    seq = buses.groupby("operating_company").cumcount() + 1
    buses["fleet_number"] = [f"{COMPANY_PREFIX[c]}{s:03d}" for c, s in zip(buses.operating_company, seq)]
    buses["annual_km"] = rng.lognormal(np.log(57_000), 0.17, len(buses))
    buses["campaign_date"] = [day_between(*CAMPAIGN_WINDOW) if b else pd.NaT for b in buses.bad_batch]
    return buses


def build_bus_months(buses):
    """One row per bus per month in service, with the true km driven."""
    rows = []
    for b in buses.itertuples():
        for ms in pd.date_range(b.in_service_date.replace(day=1), DATA_END, freq="MS"):
            first = max(ms, b.in_service_date)
            rows.append((b.Index, ms, ((month_end(ms) - first).days + 1) / month_end(ms).day))
    bm = pd.DataFrame(rows, columns=["bus", "month", "frac"])
    season = bm.month.dt.month.map({8: 0.95, 12: 0.92}).fillna(1.0).values
    off_road = np.where(rng.random(len(bm)) < 0.01, 0.2, 1.0)
    bm["km"] = (buses.annual_km.values[bm.bus] / 12 * bm.frac * season * off_road
                * rng.uniform(0.85, 1.12, len(bm)))
    mid = bm.month + pd.Timedelta(days=14)
    bm["age_m"] = ((mid - buses.in_service_date.values[bm.bus]).dt.days / 30.44).clip(lower=0)
    go_live = buses.depot.map(lambda d: pd.Timestamp(DEPOTS[d][2])).values
    bm["eam_live"] = bm.month.values >= go_live[bm.bus]
    return bm


def build_odometer(buses, bm):
    reading = rng.uniform(30, 400, len(buses))[bm.bus] + bm.groupby("bus").km.cumsum().values
    odo = pd.DataFrame({"bus": bm.bus, "reading_date": bm.month.map(month_end),
                        "odometer_km": reading})
    # Planted: spikes from a mis-mapped telematics unit, then gaps in the feed.
    for b in rng.choice(len(buses), size=int(0.04 * len(buses)), replace=False):
        rows = odo.index[odo.bus == b]
        for r in rng.choice(rows, size=min(len(rows), int(rng.integers(1, 3))), replace=False):
            odo.at[r, "odometer_km"] *= rng.uniform(3, 9)
    odo = odo[rng.random(len(odo)) > 0.025].copy()
    odo.insert(0, "body_number", buses.body_number.values[odo.bus])
    odo["odometer_km"] = odo.odometer_km.round(1)
    return odo.drop(columns="bus")


def build_components():
    rows = []
    for name, system, tier, price, hours, profile, opts in COMPONENTS:
        r = dict(SYSTEMS[system])
        r.update({k: v for k, v in opts.items() if k in r})
        r.update(component=name, system=system, price=price, hours=hours, profile=profile,
                 models=opts.get("models", ("DD", "SD")), kit=opts.get("kit", False),
                 warranty_months=opts.get("warranty_months", WARRANTY_MONTHS),
                 weight=TIER[tier] * rng.lognormal(0, 0.45))
        rows.append(r)
    return pd.DataFrame(rows)


def build_parts(comp):
    used = set()

    def new_number(prefix, digits):
        while True:
            n = f"{prefix}{rng.integers(10 ** (digits - 1), 10 ** digits)}"
            if n not in used:
                used.add(n)
                return n

    def price(p):
        return round(p * rng.uniform(0.9, 1.1), 2)

    parts, comp_parts = [], {}
    for i, c in comp.iterrows():
        base = dict(component=c.component, system=c.system, is_consumable=False, unit="EA",
                    models="|".join(c.models), superseded_by="")
        if c.component == "Door control unit":
            rev_b = dict(base, part_number=new_number("P", 6), description="Door control unit assy rev B",
                         list_price_gbp=price(c.price * 1.08))
            rev_a = dict(base, part_number=new_number("P", 6), description="Door control unit assy rev A",
                         list_price_gbp=price(c.price), superseded_by=rev_b["part_number"])
            parts += [rev_a, rev_b]
            comp_parts[i] = dict(assy=rev_a["part_number"], rev_b=rev_b["part_number"])
            continue
        assy = dict(base, part_number=new_number("P", 6), description=f"{c.component} assy",
                    list_price_gbp=price(c.price))
        parts.append(assy)
        comp_parts[i] = dict(assy=assy["part_number"])
        if c.kit:
            kit = dict(base, part_number=new_number("P", 6), description=f"{c.component} repair kit",
                       list_price_gbp=price(c.price * 0.25))
            parts.append(kit)
            comp_parts[i]["kit"] = kit["part_number"]
    consumables = {}
    for name, unit, p, _, _ in CONSUMABLES:
        pn = new_number("P", 6)
        parts.append(dict(part_number=pn, description=name, component=name, system="Consumables",
                          is_consumable=True, unit=unit, list_price_gbp=p, models="DD|SD",
                          superseded_by=""))
        consumables[name] = pn
    parts = pd.DataFrame(parts)

    # Operator stores codes. Some parts were re-coded part-way through, so one
    # physical part shows up under two codes and two descriptions.
    dcu = set(comp_parts[comp.index[comp.component == "Door control unit"][0]].values())
    recodable = [p for p in parts.part_number[~parts.is_consumable] if p not in dcu]
    recoded = set(rng.choice(recodable, size=14, replace=False))
    codes = []
    for p in parts.itertuples():
        desc = op_description(p.description)
        new = new_number("7", 7)
        if p.part_number in recoded:
            switch = day_between(pd.Timestamp("2024-06-01"), pd.Timestamp("2025-06-30"))
            codes.append(dict(operator_part_code=new_number("7", 7), part_number=p.part_number,
                              operator_description=f"DO NOT USE - SEE {new} {desc}", until=switch))
            codes.append(dict(operator_part_code=new, part_number=p.part_number,
                              operator_description=desc, until=pd.NaT))
        else:
            codes.append(dict(operator_part_code=new, part_number=p.part_number,
                              operator_description=desc, until=pd.NaT))
    codes = pd.DataFrame(codes)

    # Planted: the cross-reference is incomplete.
    unmapped = (rng.random(len(codes)) < 0.09) & ~codes.part_number.isin(dcu)
    xref = codes[["operator_part_code", "operator_description", "part_number"]].copy()
    xref.loc[unmapped, "part_number"] = ""
    return parts, comp_parts, consumables, codes, xref


def op_description(desc):
    words = desc.replace(" assy", "").upper().split()
    words = [ABBREV.get(w, w) for w in words]
    if len(words) > 1 and rng.random() < 0.5:
        words = [words[-1]] + words[:-1]
    return " ".join(words)


class Builder:
    """Turns failure events into work-order and warranty-claim lines."""

    def __init__(self, buses, comp, parts, comp_parts, consumables, codes):
        self.buses, self.comp = buses, comp.to_dict("records")
        self.price = dict(zip(parts.part_number, parts.list_price_gbp))
        self.desc = dict(zip(parts.part_number, parts.description))
        self.comp_parts, self.consumables = comp_parts, consumables
        self.repair_consumables = [c for c in CONSUMABLES if c[3] in ("repair", "both")]
        self.cons_qty = {c[0]: c[4] for c in CONSUMABLES}
        self.codes = {pn: g.to_dict("records") for pn, g in codes.groupby("part_number")}
        self.by_system = {}
        for i, c in enumerate(self.comp):
            self.by_system.setdefault(c["system"], []).append(i)
        self.workshop, self.claims = [], []

    def part_for(self, ci, date):
        cp = self.comp_parts[ci]
        if "rev_b" in cp:
            return cp["rev_b"] if date >= DCU_REV_B_FROM and rng.random() < 0.9 else cp["assy"]
        if "kit" in cp and rng.random() < 0.4:
            return cp["kit"]
        return cp["assy"]

    def qty_for(self, ci):
        price = self.comp[ci]["price"]
        if price < 40:
            return int(rng.choice([1, 2, 3, 4], p=[0.75, 0.15, 0.06, 0.04]))
        if price < 5000:
            return int(rng.choice([1, 2], p=[0.93, 0.07]))
        return 1

    def consumable_line(self):
        name = self.repair_consumables[rng.integers(len(self.repair_consumables))][0]
        lo, hi = self.cons_qty[name]
        return self.consumables[name], int(rng.integers(lo, hi + 1))

    def symptom(self, ci):
        c = self.comp[ci]
        pool = SYMPTOMS_HV if c["system"] == "HV & traction" else SYMPTOMS
        return pool[rng.integers(len(pool))].format(c=c["component"].lower())

    def failure(self, bus, ci, date):
        c, b = self.comp[ci], self.buses.loc[bus]
        r = rng.random()
        wo_type = "Breakdown" if r < c["bd"] else (
            "Driver Defect" if rng.random() < c["dd"] else "Work Arising")
        in_warranty = (date - b.in_service_date).days / 30.44 < c["warranty_months"]
        if in_warranty and rng.random() < c["wp"]:
            source = "warranty"
        elif date >= pd.Timestamp(DEPOTS[b.depot][2]):
            source = "workshop"
        else:
            return False  # happened, but no system recorded it

        comps = [ci]
        if rng.random() < 0.07:
            comps.append(int(rng.choice(self.by_system[c["system"]])))
        lines = [(self.part_for(i, date), self.qty_for(i)) for i in comps]
        if rng.random() < (0.05 if source == "warranty" else 0.22):
            lines += [self.consumable_line() for _ in range(int(rng.integers(1, 3)))]

        symptom = self.symptom(ci)
        if source == "warranty":
            complaint = rng.choice(CLAIM_COMPLAINT[wo_type]).format(s=symptom)
            self.claim(bus, date, complaint, lines)
        else:
            hours = sum(self.comp[i]["hours"] for i in comps) * rng.lognormal(0, 0.45) + 0.2
            hours += 0.8 if wo_type == "Breakdown" else 0
            self.work_order(bus, date, wo_type, WO_PREFIX[wo_type] + symptom, lines, hours)
        return True

    def work_order(self, bus, date, wo_type, description, lines, hours):
        if hours is not None and rng.random() < 0.03:
            hours = None
        self.workshop.append(dict(bus=bus, date=date, wo_type=wo_type, description=description,
                                  lines=lines, hours=None if hours is None else round(hours, 1)))

    def claim(self, bus, date, complaint, lines):
        claim_date = date + pd.Timedelta(days=3 + int(rng.gamma(2, 9)))
        if claim_date > CLAIMS_EXTRACT:
            return  # repaired, but not claimed yet when the extract was taken
        self.claims.append(dict(bus=bus, repair_date=date, claim_date=claim_date,
                                complaint=complaint, lines=lines))

    def operator_code(self, part_number, date):
        options = self.codes[part_number]
        if len(options) == 1:
            return options[0]
        old, new = options
        return old if date < old["until"] or rng.random() < 0.15 else new

    def workshop_rows(self):
        rows, ref = [], 3104001
        for wo in sorted(self.workshop, key=lambda w: w["date"]):
            ref += int(rng.integers(1, 4))
            b = self.buses.loc[wo["bus"]]
            lines = list(wo["lines"])
            if rng.random() < 0.025:
                pn, qty = lines[int(rng.integers(len(lines)))]
                back = qty if qty == 1 or rng.random() < 0.4 else int(rng.integers(1, qty))
                lines.append((pn, -back))
            for pn, qty in lines:
                code = self.operator_code(pn, wo["date"])
                rows.append(dict(wo_ref=f"WO{ref}", wo_date=wo["date"].date(),
                                 plant_code=DEPOTS[b.depot][0], fleet_number=b.fleet_number,
                                 wo_type=wo["wo_type"], wo_description=wo["description"],
                                 operator_part_code=code["operator_part_code"],
                                 operator_part_description=code["operator_description"],
                                 qty=qty, wo_total_hours=wo["hours"]))
        return pd.DataFrame(rows)

    def claim_rows(self):
        rows, ref, fleet_ref = [], 210000, None
        for cl in sorted(self.claims, key=lambda c: c["claim_date"]):
            ref += 1
            b = self.buses.loc[cl["bus"]]
            # Planted: the fleet reference is keyed by hand and usually copied
            # from the previous claim, so it does not identify the bus.
            if fleet_ref is None or rng.random() < 0.2:
                fleet_ref = b.fleet_number
            for pn, qty in cl["lines"]:
                rows.append(dict(claim_ref=f"WC{ref}", claim_date=cl["claim_date"].date(),
                                 repair_date=cl["repair_date"].date(), body_number=b.body_number,
                                 customer_fleet_ref=fleet_ref, complaint=cl["complaint"],
                                 part_number=pn, part_description=self.desc[pn], qty=qty,
                                 part_cost_gbp=round(self.price[pn] * qty * rng.uniform(0.92, 1.08), 2)))
        return pd.DataFrame(rows)


def simulate_failures(buses, bm, comp):
    model_idx = (buses.model.values[bm.bus] == "SD").astype(int)
    fitted = np.array([[m in models for m in ("DD", "SD")] for models in comp.models])
    model_mult = rng.lognormal(0, 0.25, fitted.shape) * fitted
    age = bm.age_m.values
    profile = {"infant": 1 + 1.5 * np.exp(-age / 3), "wear": 0.5 + age / 24,
               "random": np.ones_like(age)}
    duty = np.array([DEPOTS[d][3] for d in buses.depot])[bm.bus]
    rate = (bm.km.values[:, None] * comp.weight.values[None, :] * model_mult[:, model_idx].T
            * np.stack([profile[p] for p in comp.profile], axis=1) * duty[:, None])

    rate *= TARGET_FAILURES / rate.sum()
    campaign_month = buses.campaign_date.dt.to_period("M").dt.to_timestamp().values[bm.bus]
    bad = buses.bad_batch.values[bm.bus] & (bm.month.values < campaign_month)
    rate[bad, comp.index[comp.component == "Door control unit"][0]] += (
        BAD_BATCH_FAILURES_PER_BUS_MONTH * bm.frac.values[bad])

    counts = rng.poisson(rate)
    events = []
    for r, ci in zip(*np.nonzero(counts)):
        bus, ms = bm.bus.iat[r], bm.month.iat[r]
        start = max(ms, buses.in_service_date.iat[bus])
        for _ in range(counts[r, ci]):
            events.append((bus, ci, day_between(start, min(month_end(ms), DATA_END))))
    return sorted(events, key=lambda e: e[2])


def add_preventive(builder, buses, bm, consumables, comp_parts, comp):
    names = list(PM_ITEMS)
    weights = np.array(list(PM_ITEMS.values()))
    weights = weights / weights.sum()
    comp_index = {c: i for i, c in enumerate(comp.component)}
    cons_qty = {c[0]: c[4] for c in CONSUMABLES}
    for row in bm[bm.eam_live].itertuples():
        for _ in range(rng.poisson(PM_PER_BUS_MONTH * row.frac)):
            start = max(row.month, buses.in_service_date.iat[row.bus])
            date = day_between(start, min(month_end(row.month), DATA_END))
            lines = []
            for name in rng.choice(names, size=min(1 + rng.poisson(1.7), 9), replace=False, p=weights):
                if name in consumables:
                    lo, hi = cons_qty[name]
                    lines.append((consumables[name], int(rng.integers(lo, hi + 1))))
                else:
                    lines.append((comp_parts[comp_index[name]]["assy"], 1))
            builder.work_order(row.bus, date, "Preventive maintenance",
                               "Preventive maintenance inspection", lines,
                               rng.lognormal(np.log(1.8), 0.5))


def add_accidents(builder, buses, bm, comp_parts, comp):
    live = bm[bm.eam_live]
    comp_index = {c: i for i, c in enumerate(comp.component)}
    for r in rng.choice(live.index, size=ACCIDENTS, replace=False, p=live.km / live.km.sum()):
        row = live.loc[r]
        start = max(row.month, buses.in_service_date.iat[row.bus])
        date = day_between(start, min(month_end(row.month), DATA_END))
        damaged = rng.choice(ACCIDENT_COMPONENTS, size=int(rng.integers(2, 6)), replace=False)
        lines = [(comp_parts[comp_index[c]]["assy"], 1) for c in damaged]
        if rng.random() < 0.7:
            lines.append(builder.consumable_line())
        builder.work_order(row.bus, date, "Accident Damaged",
                           f"Accident damage - {damaged[0].lower()} damaged", lines,
                           rng.lognormal(np.log(5), 0.5))


def add_parts_issues(builder, buses, parts):
    """Bulk issues in the months before a depot's EAM go-live, with no hours."""
    first_go_live = min(pd.Timestamp(v[2]) for v in DEPOTS.values())
    stock = parts.part_number.values
    for depot, (_, _, go_live, _) in DEPOTS.items():
        go_live = pd.Timestamp(go_live)
        window_start = go_live - pd.Timedelta(days=90)
        candidates = buses.index[(buses.depot == depot) & (buses.in_service_date < window_start)]
        if go_live == first_go_live or len(candidates) == 0:
            continue
        for _ in range(int(rng.integers(5, 10))):
            lines = [(pn, int(rng.integers(1, 4))) for pn in
                     rng.choice(stock, size=int(rng.integers(3, 11)), replace=False)]
            builder.work_order(int(rng.choice(candidates)), day_between(window_start, go_live - pd.Timedelta(days=1)),
                               "Parts Issue", "Parts issue to vehicle", lines, None)


def add_campaign(builder, buses, comp_parts, comp):
    rev_b = comp_parts[comp.index[comp.component == "Door control unit"][0]]["rev_b"]
    for bus in buses.index[buses.bad_batch]:
        lines = [(rev_b, 1)]
        if rng.random() < 0.5:
            lines.append(builder.consumable_line())
        builder.work_order(bus, buses.campaign_date.iat[bus], "Campaign WO",
                           "Campaign C25-03: replace door control unit with rev B", lines,
                           rng.lognormal(np.log(1.6), 0.25))


def main():
    buses = build_buses()
    bm = build_bus_months(buses)
    odo = build_odometer(buses, bm)
    comp = build_components()
    parts, comp_parts, consumables, codes, xref = build_parts(comp)

    builder = Builder(buses, comp, parts, comp_parts, consumables, codes)
    events = simulate_failures(buses, bm, comp)
    recorded = sum(builder.failure(bus, ci, date) for bus, ci, date in events)
    add_preventive(builder, buses, bm, consumables, comp_parts, comp)
    add_accidents(builder, buses, bm, comp_parts, comp)
    add_parts_issues(builder, buses, parts)
    add_campaign(builder, buses, comp_parts, comp)

    workshop = builder.workshop_rows()
    claims = builder.claim_rows()
    depots = pd.DataFrame([dict(plant_code=v[0], depot=k, operating_company=v[1], eam_go_live=v[2])
                           for k, v in DEPOTS.items()])
    bus_table = buses.assign(delivery_date=buses.delivery_date.dt.date,
                             in_service_date=buses.in_service_date.dt.date)[
        ["body_number", "fleet_number", "model", "operating_company", "depot", "batch",
         "delivery_date", "in_service_date"]]
    odo["reading_date"] = odo.reading_date.dt.date

    OUT.mkdir(parents=True, exist_ok=True)
    tables = {"depots": depots, "buses": bus_table, "odometer_monthly": odo,
              "parts": parts, "operator_part_xref": xref,
              "workshop_lines": workshop, "warranty_claim_lines": claims}
    for name, df in tables.items():
        df.to_csv(OUT / f"{name}.csv", index=False)
        print(f"{name:22s} {len(df):>7,} rows")

    print(f"\nfailures simulated {len(events):,}, recorded {recorded:,} "
          f"(the rest happened before a depot's EAM go-live)")
    print(workshop.drop_duplicates("wo_ref").wo_type.value_counts().to_string())
    print(f"warranty claims    {claims.claim_ref.nunique():,}")


if __name__ == "__main__":
    main()
