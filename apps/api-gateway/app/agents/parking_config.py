"""
Single source of truth for Fountainhead parking charge data.
Imported by AdminAgent to inject structured pricing into the LLM context,
enabling the model to answer cost queries and perform calculations without a database.
"""

PARKING_CHARGES = {
    "2W": [
        {"option": "Monthly Parking (AASPL)", "charge": "Rs 800/month",  "remarks": "Through AASPL"},
        {"option": "Daily Parking",           "charge": "Rs 50/day",     "remarks": "Pay directly at Fountainhead entry point"},
    ],
    "4W": [
        {"option": "Monthly Parking (AASPL)", "charge": "Rs 4,500/month", "remarks": "Through AASPL"},
        {"option": "Daily Pass",              "charge": "Rs 150/day",    "remarks": "Single entry & exit only; additional charges for multiple entries/exits"},
        {"option": "Monthly Pass",            "charge": "Rs 2,500/month", "remarks": "Multiple entries & exits allowed"},
    ],
}

PARKING_CONTEXT = """\
[Parking Policy — Fountainhead / AASPL]

## Fountainhead Parking Charges

### Two-Wheeler (2W)
| Parking Option           | Charges      | Remarks                                      |
|--------------------------|--------------|----------------------------------------------|
| Monthly Parking (AASPL)  | Rs 800/month | Through AASPL                                |
| Daily Parking            | Rs 50/day    | Pay directly at Fountainhead entry point     |

### Four-Wheeler (4W)
| Parking Option           | Charges        | Remarks                                                                  |
|--------------------------|----------------|--------------------------------------------------------------------------|
| Monthly Parking (AASPL)  | Rs 4,500/month | Through AASPL                                                            |
| Daily Pass               | Rs 150/day     | Single entry & exit only; additional charges for multiple entries/exits  |
| Monthly Pass             | Rs 2,500/month | Multiple entries & exits allowed                                         |

### Key Facts for Calculations
- 2W monthly via AASPL: Rs 800/month. Daily rate: Rs 50/day. Break-even: 16 days/month.
- 4W AASPL monthly: Rs 4,500/month. Break-even vs daily pass (Rs 150/day): 30 days/month.
- 4W standard monthly pass: Rs 2,500/month. Break-even vs daily pass (Rs 150/day): 17 days/month.
- 4W daily pass (Rs 150/day) is for single entry/exit only. Multiple entries/exits incur extra charges.
- 4W monthly pass (Rs 2,500/month) allows unlimited entries and exits.
- AASPL monthly sticker requires a formal application through the parking tracker in AURA.
- Daily parking at Fountainhead is paid directly at the entry gate — no advance sticker required.
"""
