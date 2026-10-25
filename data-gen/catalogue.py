"""
Component catalogue: what can fail, roughly how often, and what it costs.

Prices and labour hours are plausible round numbers for UK bus parts, not
anyone's price list. Tiers set the relative failure frequency per km before
random spread is added in generate.py, so the final ranking is not hand-picked.
"""

TIER = {"H": 4.5, "M": 2.5, "L": 0.6, "VL": 0.12, "XL": 0.02}

# System defaults, overridable per component:
#   bd = share of corrective events that are in-service breakdowns
#   dd = share of the remaining events reported by drivers (the rest are
#        found by fitters during inspection - "work arising")
#   wp = share of in-warranty failures claimed back from the manufacturer
SYSTEMS = {
    "Doors & access": dict(bd=0.08, dd=0.70, wp=0.40),
    "Low-voltage electrical": dict(bd=0.05, dd=0.55, wp=0.30),
    "Driver's cab": dict(bd=0.04, dd=0.80, wp=0.40),
    "Saloon interior": dict(bd=0.00, dd=0.45, wp=0.12),
    "Body & glazing": dict(bd=0.00, dd=0.20, wp=0.15),
    "Brakes & air": dict(bd=0.20, dd=0.40, wp=0.45),
    "Steering & suspension": dict(bd=0.12, dd=0.30, wp=0.40),
    "HV & traction": dict(bd=0.45, dd=0.50, wp=0.85),
    "Charging": dict(bd=0.10, dd=0.60, wp=0.60),
    "Thermal & HVAC": dict(bd=0.06, dd=0.55, wp=0.50),
    "Passenger info & CCTV": dict(bd=0.00, dd=0.60, wp=0.55),
}

# (component, system, tier, list price GBP, labour hours, age profile, options)
#   age profile: "infant" fails early then settles, "wear" rises with age,
#                "random" is flat
#   options:     models=("DD",) for double-deck-only parts, warranty_months,
#                kit=True adds a cheaper repair-kit part alongside the assembly,
#                plus any SYSTEMS key to override the system default
COMPONENTS = [
    ("Entrance door actuator", "Doors & access", "M", 420, 2.5, "wear", dict(kit=True)),
    ("Door sensitive edge", "Doors & access", "H", 95, 1.2, "wear", {}),
    ("Door control unit", "Doors & access", "L", 780, 1.5, "infant", dict(bd=0.25)),
    ("Door open/close button", "Doors & access", "H", 28, 0.5, "random", {}),
    ("Door seal", "Doors & access", "M", 60, 1.0, "wear", {}),
    ("Emergency door release valve", "Doors & access", "L", 140, 1.0, "random", {}),
    ("Wheelchair ramp handle", "Doors & access", "M", 35, 0.5, "wear", dict(kit=True)),
    ("Wheelchair ramp", "Doors & access", "L", 640, 1.5, "wear", {}),
    ("Kneeling valve", "Doors & access", "L", 210, 1.5, "random", dict(bd=0.15)),

    ("24V blade fuse", "Low-voltage electrical", "H", 4, 0.3, "random", dict(bd=0.10)),
    ("24V auxiliary battery", "Low-voltage electrical", "M", 330, 1.0, "wear", dict(bd=0.30)),
    ("Steering column switch", "Low-voltage electrical", "M", 85, 1.0, "random", {}),
    ("Side marker lamp", "Low-voltage electrical", "H", 22, 0.4, "random", dict(dd=0.20)),
    ("Headlamp unit", "Low-voltage electrical", "L", 310, 0.8, "random", {}),
    ("Rear lamp cluster", "Low-voltage electrical", "L", 180, 0.6, "random", {}),
    ("Saloon light strip", "Low-voltage electrical", "M", 120, 0.8, "infant", {}),
    ("24V relay", "Low-voltage electrical", "M", 15, 0.4, "random", {}),
    ("Wiring harness repair section", "Low-voltage electrical", "M", 45, 2.0, "random", dict(bd=0.12)),
    ("Wiper motor", "Low-voltage electrical", "L", 260, 1.5, "wear", {}),
    ("Reversing camera", "Low-voltage electrical", "L", 190, 1.0, "infant", {}),
    ("Horn", "Low-voltage electrical", "L", 45, 0.5, "random", {}),

    ("Driver's seat", "Driver's cab", "L", 1450, 2.0, "wear", dict(kit=True)),
    ("Cab seatbelt", "Driver's cab", "M", 140, 0.8, "wear", {}),
    ("Cab door lock", "Driver's cab", "M", 75, 0.8, "random", {}),
    ("Instrument cluster", "Driver's cab", "L", 1100, 1.2, "infant", dict(bd=0.30, wp=0.90)),
    ("Camera mirror monitor", "Driver's cab", "L", 720, 1.0, "infant", dict(bd=0.20, wp=0.90)),
    ("Camera mirror housing", "Driver's cab", "M", 160, 0.8, "random", dict(wp=0.30)),
    ("Drive start switch", "Driver's cab", "M", 18, 0.5, "random", dict(bd=0.25)),
    ("Cab sun blind", "Driver's cab", "M", 95, 0.6, "wear", {}),
    ("Cab heater fan", "Driver's cab", "L", 230, 1.5, "wear", {}),

    ("Bell push", "Saloon interior", "H", 32, 0.4, "random", {}),
    ("Emergency break-glass button", "Saloon interior", "H", 24, 0.3, "random", dict(wp=0.10)),
    ("Seat headrest cover", "Saloon interior", "H", 18, 0.3, "wear", dict(wp=0.05, dd=0.20)),
    ("Passenger seat frame", "Saloon interior", "L", 260, 1.0, "random", {}),
    ("Handrail bump pad", "Saloon interior", "M", 9, 0.3, "wear", {}),
    ("USB-C charging port", "Saloon interior", "H", 38, 0.5, "infant", dict(wp=0.60)),
    ("Cup holder", "Saloon interior", "M", 12, 0.2, "random", {}),
    ("Saloon air vent", "Saloon interior", "M", 14, 0.3, "random", {}),
    ("Saloon heater fan", "Saloon interior", "M", 190, 1.2, "wear", {}),
    ("Stair lighting", "Saloon interior", "M", 65, 0.6, "infant", dict(models=("DD",))),
    ("Upper deck window", "Saloon interior", "L", 420, 2.5, "random", dict(models=("DD",))),
    ("Grab pole", "Saloon interior", "L", 75, 0.8, "random", {}),
    ("Floor covering repair", "Saloon interior", "L", 85, 2.0, "wear", {}),

    ("Belly panel", "Body & glazing", "M", 70, 1.0, "random", {}),
    ("Side skirt panel", "Body & glazing", "L", 180, 1.5, "random", {}),
    ("Wheel trim", "Body & glazing", "M", 28, 0.2, "random", {}),
    ("Windscreen", "Body & glazing", "VL", 1150, 4.0, "random", {}),
    ("Side window", "Body & glazing", "L", 360, 2.0, "random", {}),
    ("Rear service door lock", "Body & glazing", "M", 48, 0.6, "wear", {}),
    ("Wiper arm", "Body & glazing", "M", 45, 0.4, "wear", {}),
    ("Bumper corner", "Body & glazing", "L", 290, 1.5, "random", {}),
    ("Mirror arm", "Body & glazing", "L", 210, 1.0, "random", {}),

    ("Air compressor", "Brakes & air", "L", 1330, 3.0, "wear", dict(bd=0.50, wp=0.80, kit=True)),
    ("Air dryer cartridge", "Brakes & air", "M", 55, 0.6, "wear", {}),
    ("Brake chamber", "Brakes & air", "L", 160, 1.5, "wear", {}),
    ("Brake pad set", "Brakes & air", "L", 240, 2.0, "wear", {}),
    ("ABS sensor", "Brakes & air", "M", 55, 1.0, "random", dict(bd=0.30)),
    ("Air line coupling", "Brakes & air", "M", 18, 0.8, "random", dict(bd=0.25)),
    ("Parking brake valve", "Brakes & air", "L", 190, 1.5, "random", dict(bd=0.30)),

    ("Drag link", "Steering & suspension", "L", 320, 2.5, "wear", {}),
    ("Track rod end", "Steering & suspension", "L", 95, 1.5, "wear", {}),
    ("Air suspension bellows", "Steering & suspension", "M", 135, 1.5, "wear", dict(bd=0.30)),
    ("Shock absorber", "Steering & suspension", "M", 110, 1.0, "wear", {}),
    ("Levelling valve", "Steering & suspension", "M", 120, 1.2, "random", dict(bd=0.20)),
    ("Anti-roll bar link", "Steering & suspension", "L", 75, 1.0, "wear", {}),
    ("Steering box", "Steering & suspension", "VL", 2400, 5.0, "wear", dict(bd=0.50)),

    ("HV fuse", "HV & traction", "M", 63, 1.0, "infant", {}),
    ("HV interlock connector", "HV & traction", "M", 85, 1.2, "infant", {}),
    ("DC/DC converter", "HV & traction", "L", 2900, 2.5, "infant", dict(bd=0.60)),
    ("Traction inverter", "HV & traction", "VL", 9200, 6.0, "infant", dict(bd=0.80)),
    ("Traction motor", "HV & traction", "XL", 15500, 10.0, "random", dict(bd=0.90, warranty_months=60)),
    ("Traction battery module", "HV & traction", "VL", 7800, 6.0, "random", dict(warranty_months=96)),
    ("Traction battery pack", "HV & traction", "XL", 72000, 16.0, "random", dict(bd=0.90, warranty_months=96)),
    ("Battery management controller", "HV & traction", "L", 1350, 2.0, "infant", {}),
    ("HV cable assembly", "HV & traction", "L", 480, 3.0, "random", {}),
    ("Insulation monitoring device", "HV & traction", "L", 420, 1.5, "infant", {}),
    ("Vehicle control unit", "HV & traction", "L", 1900, 2.0, "infant", dict(bd=0.60)),
    ("Battery coolant pump", "HV & traction", "M", 460, 2.0, "wear", dict(bd=0.50)),
    ("Battery chiller", "HV & traction", "VL", 2100, 4.0, "random", {}),

    ("Charge inlet", "Charging", "L", 850, 2.0, "wear", {}),
    ("Charge flap actuator", "Charging", "M", 58, 0.8, "random", {}),
    ("Charging controller", "Charging", "L", 1600, 2.0, "infant", {}),

    ("Saloon HVAC unit", "Thermal & HVAC", "VL", 6400, 6.0, "random", {}),
    ("HVAC blower motor", "Thermal & HVAC", "L", 380, 2.0, "wear", {}),
    ("Heat pump compressor", "Thermal & HVAC", "VL", 3800, 5.0, "random", {}),
    ("Coolant hose", "Thermal & HVAC", "M", 35, 1.0, "wear", dict(bd=0.30)),
    ("Coolant expansion cap", "Thermal & HVAC", "L", 22, 0.3, "random", {}),
    ("Saloon recirculation fan", "Thermal & HVAC", "M", 85, 0.8, "wear", {}),

    ("Destination display", "Passenger info & CCTV", "L", 1250, 1.5, "infant", dict(bd=0.15)),
    ("Next-stop display", "Passenger info & CCTV", "L", 680, 1.0, "infant", {}),
    ("Saloon CCTV camera", "Passenger info & CCTV", "M", 240, 1.0, "infant", {}),
    ("CCTV recorder", "Passenger info & CCTV", "L", 1800, 1.5, "infant", {}),
    ("Telematics gateway", "Passenger info & CCTV", "L", 520, 1.0, "infant", {}),
    ("Audio announcement unit", "Passenger info & CCTV", "L", 640, 1.0, "infant", {}),
]

# (name, unit, price GBP, where it is used, qty range)
#   "repair" = fitted alongside corrective repairs, "pm" = preventive only
CONSUMABLES = [
    ("Cable tie 300mm", "EA", 0.12, "repair", (2, 20)),
    ("M6 flange nut", "EA", 0.35, "repair", (2, 12)),
    ("M8 hex bolt", "EA", 0.55, "repair", (1, 8)),
    ("Blind rivet nut M6", "EA", 0.85, "repair", (2, 10)),
    ("Pop rivet 4.8mm", "EA", 0.08, "repair", (4, 30)),
    ("Sealant cartridge", "EA", 8.40, "repair", (1, 2)),
    ("Threadlock 50ml", "EA", 9.10, "repair", (1, 1)),
    ("Insulation tape", "EA", 1.40, "repair", (1, 2)),
    ("Crimp terminal", "EA", 0.30, "repair", (2, 10)),
    ("Heat shrink sleeve", "EA", 0.45, "repair", (2, 6)),
    ("Battery coolant 50/50", "L", 3.20, "both", (5, 25)),
    ("Multipurpose grease", "KG", 6.50, "pm", (1, 3)),
    ("Screenwash concentrate", "L", 1.10, "pm", (5, 20)),
    ("Cabin air filter", "EA", 24.00, "pm", (1, 2)),
    ("HVAC return air filter", "EA", 38.00, "pm", (1, 4)),
    ("Wiper blade", "EA", 16.00, "both", (1, 2)),
    ("24V bulb", "EA", 2.50, "both", (1, 4)),
    ("Gear oil", "L", 7.80, "pm", (1, 6)),
    ("Brake cleaner", "EA", 4.20, "pm", (1, 3)),
    ("Hand cleaner wipes", "EA", 4.00, "pm", (1, 2)),
]

# Relative weight of each item on a preventive-maintenance work order.
# The components here are replaced on schedule, not because they failed -
# which is why "is it a failure?" depends on the work order type, not the part.
PM_ITEMS = {
    "Battery coolant 50/50": 3, "Multipurpose grease": 2, "Screenwash concentrate": 2,
    "Cabin air filter": 2, "HVAC return air filter": 2, "Wiper blade": 2,
    "24V bulb": 1, "Gear oil": 1, "Brake cleaner": 0.5, "Hand cleaner wipes": 0.5,
    "Air dryer cartridge": 1.5, "Brake pad set": 0.5, "Door seal": 1.2,
    "Seat headrest cover": 1.5, "Handrail bump pad": 1, "Side marker lamp": 1,
    "Wiper arm": 0.6, "Air suspension bellows": 0.4, "Shock absorber": 0.4,
}

# Components that turn up on accident-damage work orders.
ACCIDENT_COMPONENTS = [
    "Bumper corner", "Mirror arm", "Side skirt panel", "Side window", "Windscreen",
    "Camera mirror housing", "Belly panel", "Wheel trim", "Rear lamp cluster", "Headlamp unit",
]

# Free-text fault descriptions. {c} is the component in lower case.
SYMPTOMS = ["{c} not working", "{c} intermittent fault", "{c} faulty", "{c} damaged",
            "{c} loose", "{c} fault code on dash"]
SYMPTOMS_HV = ["HV fault warning - {c}", "reduced power, {c} fault", "{c} isolation fault",
               "{c} fault code, vehicle will not drive"]
