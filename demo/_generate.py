"""Reproducible synthetic deal flow for the Skarv Ventures demo (spec §1).

    python demo/_generate.py

writes ``demo/inbound_records.csv`` (412 raw inbound records) and ``demo/signals.csv``
(the enrichment mock). Everything is fictional: company names are invented, websites
use the reserved ``.example`` domain, and LPs, angels and funds are made up.
"""

import csv
import datetime
import random
from pathlib import Path

from faker import Faker

SEED = 20260930
DEMO_FOLDER = Path(__file__).resolve().parent
INBOUND_PATH = DEMO_FOLDER / "inbound_records.csv"
SIGNALS_PATH = DEMO_FOLDER / "signals.csv"

INBOUND_COLUMNS = [
    "record_id",
    "channel",
    "received_at",
    "recipient",
    "company_name",
    "website",
    "founder_name",
    "founder_email",
    "founder_linkedin",
    "country",
    "stage",
    "round_size_eur",
    "one_liner",
    "deck_text",
    "introducer_name",
    "introducer_type",
]
SIGNAL_COLUMNS = [
    "signal_id",
    "company_name",
    "website",
    "signal_type",
    "event_date",
    "description",
    "lead_investor",
]

PARTNERS = ["Astrid Holm", "Jonas Weber", "Mette Lund"]
PRINCIPALS = ["Lukas Brandt", "Sofie Nygaard"]
ASSOCIATES = ["Emil Karlsson", "Lea Hoffmann"]
TEAM = PARTNERS + PRINCIPALS + ASSOCIATES

INTRODUCERS = {
    "LP": ["Hvidsten Family Office", "Kvarnbo Pension Fund", "Elbtal Stiftung"],
    "portfolio_founder": [
        "Ida Rasmussen (Loopfin)",
        "Matteo Graf (Pallettro)",
        "Sanna Virtanen (Kelo Grid)",
    ],
    "angel": ["Henrik Bjerre", "Clara Neumann", "Oskar Lindgren"],
}
COMPETITOR_FUNDS = ["Grauwolf Capital", "Tindra Ventures", "Nordhavn Partners"]
LOCALES = {
    "DK": "da_DK",
    "SE": "sv_SE",
    "NO": "no_NO",
    "FI": "fi_FI",
    "IS": "en_GB",
    "DE": "de_DE",
    "AT": "de_AT",
    "CH": "de_CH",
    "US": "en_US",
    "GB": "en_GB",
    "FR": "fr_FR",
    "NL": "nl_NL",
    "ES": "es_ES",
    "PL": "pl_PL",
    "EE": "et_EE",
}
IN_SCOPE_COUNTRIES = ["DK", "SE", "NO", "FI", "IS", "DE", "AT", "CH"]
OUT_OF_SCOPE_COUNTRIES = ["US", "GB", "FR", "NL", "ES", "PL", "EE"]
LEGAL_SUFFIX = {
    "DK": "ApS",
    "SE": "AB",
    "NO": "AS",
    "FI": "Oy",
    "DE": "GmbH",
    "AT": "GmbH",
    "CH": "AG",
}

NAME_STARTS = [
    "Fjord",
    "Volt",
    "Kelo",
    "Brim",
    "Lumo",
    "Strand",
    "Norr",
    "Tindra",
    "Vesta",
    "Kraft",
    "Arkt",
    "Birk",
    "Elva",
    "Grun",
    "Havn",
    "Iso",
    "Jord",
    "Kvist",
    "Lyng",
    "Mosk",
    "Nimbu",
    "Orka",
    "Pallo",
    "Quern",
    "Rune",
    "Sol",
    "Tuva",
    "Ulv",
    "Vind",
    "Wald",
    "Ystad",
    "Zink",
]
NAME_ENDS = [
    "byte",
    "werk",
    "loop",
    "ly",
    "flow",
    "grid",
    "stack",
    "forge",
    "wise",
    "path",
    "mint",
    "cell",
    "nest",
    "yard",
    "scope",
    "bit",
    "hub",
    "ware",
    "sense",
    "lane",
]

SECTORS = {
    "robotics": (
        "Autonomous robots for {} warehouses",
        "We build warehouse robotics and machine vision that automate picking in mid-size factories.",
    ),
    "climate": (
        "Grid software for {} battery storage fleets",
        "Energy software that forecasts grid load and schedules battery storage to cut carbon.",
    ),
    "vertical_saas": (
        "Workflow SaaS for {} construction firms",
        "B2B SaaS that digitises site workflow and supply chain paperwork for construction and manufacturing.",
    ),
    "fintech": (
        "Payments infrastructure for {} merchants",
        "An API that lets merchants accept instant payments and reconcile invoices automatically.",
    ),
    "health": (
        "Remote monitoring for {} clinics",
        "A platform that helps clinics monitor patients remotely and triage appointments.",
    ),
    "consumer": (
        "A consumer app for {} commuters",
        "A consumer mobile app that rewards commuters for greener travel choices.",
    ),
    "gaming": (
        "Casual gaming for {} players",
        "A gaming studio shipping casual mobile games with live-ops and in-app purchases.",
    ),
}
SECTOR_WEIGHTS = {
    "robotics": 3,
    "climate": 3,
    "vertical_saas": 3,
    "fintech": 2,
    "health": 2,
    "consumer": 1,
    "gaming": 1,
}
ADJECTIVES = ["European", "Nordic", "mid-size", "regional", "fast-growing", "independent"]

START_DATE = datetime.date(2026, 6, 1)
TODAY = datetime.date(2026, 9, 30)


def random_weekday(
    randomiser: random.Random, start: datetime.date, end: datetime.date
) -> datetime.date:
    while True:
        day = start + datetime.timedelta(days=randomiser.randint(0, (end - start).days))
        if day.weekday() < 5:
            return day


def unique_company_names(randomiser: random.Random, count: int) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    while len(names) < count:
        name = randomiser.choice(NAME_STARTS) + randomiser.choice(NAME_ENDS)
        if name.lower() not in seen and name.lower() != "robotix":
            seen.add(name.lower())
            names.append(name)
    return names


def company_profile(randomiser: random.Random, name: str, index: int) -> dict:
    """Company-level facts. Roughly half are built to fail a hard filter."""
    bucket = index % 10
    if bucket < 5:  # passes: Nordics/DACH, Pre-Seed/Seed, round implying a 0.5–2m ticket
        country = randomiser.choice(IN_SCOPE_COUNTRIES)
        stage = randomiser.choice(["Pre-Seed", "Seed", "Seed"])
        round_size = randomiser.randrange(1_250_000, 5_000_001, 250_000)
    elif bucket < 7:  # wrong stage
        country = randomiser.choice(IN_SCOPE_COUNTRIES)
        stage = randomiser.choice(["Series A", "Series B"])
        round_size = randomiser.randrange(6_000_000, 25_000_001, 500_000)
    elif bucket < 9:  # outside Nordics/DACH
        country = randomiser.choice(OUT_OF_SCOPE_COUNTRIES)
        stage = randomiser.choice(["Pre-Seed", "Seed"])
        round_size = randomiser.randrange(1_250_000, 5_000_001, 250_000)
    else:  # ticket mismatch
        country = randomiser.choice(IN_SCOPE_COUNTRIES)
        stage = randomiser.choice(["Pre-Seed", "Seed"])
        round_size = randomiser.choice(
            [
                randomiser.randrange(300_000, 1_000_001, 100_000),
                randomiser.randrange(6_000_000, 9_000_001, 500_000),
            ]
        )
    sector = randomiser.choices(list(SECTOR_WEIGHTS), weights=list(SECTOR_WEIGHTS.values()))[0]
    one_liner_template, deck_text = SECTORS[sector]
    faker = Faker(LOCALES[country])
    faker.seed_instance(SEED + index)
    founder_name = faker.name()
    slug = founder_name.lower().replace(" ", "-").replace(".", "")
    domain = f"{name.lower()}.example"
    return {
        "company_name": name,
        "legal_name": f"{name} {LEGAL_SUFFIX[country]}"
        if country in LEGAL_SUFFIX
        else f"{name} Ltd",
        "domain": domain,
        "founder_name": founder_name,
        "founder_email": f"{slug.split('-')[0]}@{domain}",
        "founder_linkedin": f"https://www.linkedin.com/in/{slug}-demo",
        "country": country,
        "stage": stage,
        "round_size_eur": round_size,
        "one_liner": one_liner_template.format(randomiser.choice(ADJECTIVES)),
        "deck_text": f"{name}: {deck_text} Raising {round_size / 1_000_000:.2f}m EUR ({stage}).",
    }


def base_record(profile: dict) -> dict:
    return {
        "company_name": profile["company_name"],
        "website": f"https://{profile['domain']}",
        "founder_name": profile["founder_name"],
        "founder_email": profile["founder_email"],
        "founder_linkedin": profile["founder_linkedin"],
        "country": profile["country"],
        "stage": profile["stage"],
        "round_size_eur": profile["round_size_eur"],
        "one_liner": profile["one_liner"],
        "deck_text": profile["deck_text"],
        "introducer_name": "",
        "introducer_type": "none",
    }


def with_channel(
    randomiser: random.Random, record: dict, channel: str, received_at: datetime.date
) -> dict:
    record = dict(record)
    record["channel"] = channel
    record["received_at"] = received_at.isoformat()
    if channel == "website_form":
        record["recipient"] = randomiser.choice(ASSOCIATES)
    elif channel == "cold_email":
        record["recipient"] = randomiser.choice(PARTNERS)
    elif channel == "linkedin":
        record["recipient"] = randomiser.choice(TEAM)
    else:
        introducer_type = randomiser.choice(list(INTRODUCERS))
        record["introducer_type"] = introducer_type
        record["introducer_name"] = randomiser.choice(INTRODUCERS[introducer_type])
        record["recipient"] = randomiser.choice(PARTNERS + PRINCIPALS)
    return record


def duplicate_variant(randomiser: random.Random, profile: dict, link: str) -> dict:
    """A repeat arrival that shares only one identifier with the first record."""
    record = base_record(profile)
    if link == "domain":
        record["company_name"] = randomiser.choice([profile["company_name"], profile["legal_name"]])
        record["website"] = randomiser.choice(
            [
                f"www.{profile['domain']}/",
                f"http://www.{profile['domain']}",
                f"{profile['domain']}/about/",
            ]
        )
    elif link == "email":
        record["company_name"] = profile["legal_name"]
        record["website"] = ""
        record["founder_linkedin"] = ""
    elif link == "linkedin":
        record["company_name"] = profile["company_name"].upper()
        record["website"] = ""
        record["founder_email"] = ""
        record["founder_linkedin"] = profile["founder_linkedin"].replace("https://www.", "") + "/"
    else:  # name only: nothing exact in common → fuzzy suggested merge
        record["company_name"] = randomiser.choice(
            [f"{profile['company_name']} AI", profile["legal_name"]]
        )
        record["website"] = ""
        record["founder_email"] = ""
        record["founder_linkedin"] = ""
    return record


def robotix_showcase() -> list[dict]:
    """Website form in June, two partner emails in July, LP intro in August, LinkedIn last week."""
    profile = {
        "company_name": "Robotix AI",
        "founder_name": "Freja Lindqvist",
        "country": "DE",
        "stage": "Seed",
        "round_size_eur": 3_500_000,
        "one_liner": "Autonomous picking robots for mid-size European warehouses",
        "deck_text": (
            "Robotix AI builds warehouse robotics: autonomous picking arms with machine vision "
            "that automate order picking in mid-size factories and logistics hubs. "
            "Raising 3.50m EUR (Seed)."
        ),
        "introducer_name": "",
        "introducer_type": "none",
    }
    linkedin = "https://www.linkedin.com/in/freja-lindqvist-demo"
    email = "freja@robotix.example"
    arrivals = [
        (
            "website_form",
            "2026-06-09",
            "Emil Karlsson",
            "Robotix AI",
            "https://robotix.example",
            email,
            linkedin,
        ),
        ("cold_email", "2026-07-07", "Astrid Holm", "Robotix", "www.robotix.example/", email, ""),
        ("cold_email", "2026-07-08", "Jonas Weber", "Robotix", "robotix.example", email, ""),
        ("warm_intro", "2026-08-18", "Mette Lund", "RobotiX GmbH", "", email, ""),
        (
            "linkedin",
            "2026-09-23",
            "Lea Hoffmann",
            "Robotix",
            "",
            "",
            "linkedin.com/in/freja-lindqvist-demo/",
        ),
    ]
    records = []
    for channel, received_at, recipient, name, website, founder_email, founder_linkedin in arrivals:
        record = dict(profile)
        record.update(
            channel=channel,
            received_at=received_at,
            recipient=recipient,
            company_name=name,
            website=website,
            founder_email=founder_email,
            founder_linkedin=founder_linkedin,
        )
        if channel == "warm_intro":
            record.update(introducer_name="Hvidsten Family Office", introducer_type="LP")
        records.append(record)
    return records


def build_inbound(randomiser: random.Random) -> tuple[list[dict], list[dict]]:
    names = unique_company_names(randomiser, 308)
    profiles = [company_profile(randomiser, name, index) for index, name in enumerate(names)]
    records = robotix_showcase()

    # 39 more repeat companies (40 with Robotix): 21 arrive four times, 18 three times.
    repeat_profiles = profiles[:39]
    single_profiles = profiles[39:]
    links = ["domain", "email", "linkedin"]
    for position, profile in enumerate(repeat_profiles):
        arrivals = 4 if position < 21 else 3
        dates = sorted(random_weekday(randomiser, START_DATE, TODAY) for _ in range(arrivals))
        first = with_channel(
            randomiser,
            base_record(profile),
            randomiser.choice(["website_form", "cold_email"]),
            dates[0],
        )
        records.append(first)
        for repeat, received_at in enumerate(dates[1:]):
            # Every fourth repeat company has one arrival linked by name only.
            link = "name_only" if position % 4 == 0 and repeat == 0 else randomiser.choice(links)
            channel = randomiser.choice(["cold_email", "linkedin", "website_form"])
            records.append(
                with_channel(
                    randomiser, duplicate_variant(randomiser, profile, link), channel, received_at
                )
            )

    # Singles: 24 warm intros, the rest cold channels. With the Robotix LP intro and the
    # repeat companies' channels this lands exactly 25 warm intros.
    for position, profile in enumerate(single_profiles):
        if position < 24:
            if position < 16:  # recent: within the last few working days
                received_at = random_weekday(randomiser, datetime.date(2026, 9, 24), TODAY)
            else:  # older than three working days → past the reply deadline
                received_at = random_weekday(
                    randomiser, datetime.date(2026, 9, 8), datetime.date(2026, 9, 23)
                )
            record = with_channel(randomiser, base_record(profile), "warm_intro", received_at)
        else:
            channel = randomiser.choice(["website_form", "cold_email", "linkedin"])
            record = with_channel(
                randomiser,
                base_record(profile),
                channel,
                random_weekday(randomiser, START_DATE, TODAY),
            )
        records.append(record)

    records.sort(key=lambda record: (record["received_at"], record["company_name"]))
    for number, record in enumerate(records, start=1):
        record["record_id"] = f"R{number:04d}"
    return records, profiles


def build_signals(
    randomiser: random.Random, records: list[dict], profiles: list[dict]
) -> list[dict]:
    """Dated enrichment events. Some fall after the company's last arrival (for the re-check)."""
    last_arrival: dict[str, datetime.date] = {}
    for record in records:
        received_at = datetime.date.fromisoformat(record["received_at"])
        name = record["company_name"]
        last_arrival[name] = max(last_arrival.get(name, received_at), received_at)

    signals = [
        {
            "company_name": "Robotix AI",
            "website": "https://robotix.example",
            "signal_type": "traction_update",
            "event_date": "2026-08-04",
            "description": "Signed a pilot with three Nordic 3PL warehouses",
            "lead_investor": "",
        },
        {
            "company_name": "Robotix AI",
            "website": "https://robotix.example",
            "signal_type": "senior_hire",
            "event_date": "2026-09-28",
            "description": "Hired ex-Kranwerk Robotics CTO",
            "lead_investor": "",
        },
    ]
    descriptions = {
        "senior_hire": [
            "Hired ex-Kranwerk VP Engineering",
            "Hired a Head of Sales from Brimstad Logistics",
            "Hired ex-Voltara CFO",
        ],
        "traction_update": [
            "Passed EUR 1m ARR",
            "Signed first enterprise customer",
            "Doubled paying customers since spring",
        ],
        "news": [
            "Featured in Nordic Tech Weekly",
            "Won the Oresund Startup Award",
            "Named in DACH Seed 50",
        ],
    }
    for profile in randomiser.sample(profiles, 130):
        arrived = last_arrival.get(profile["company_name"], TODAY)
        for _ in range(randomiser.randint(1, 3)):
            after_arrival = randomiser.random() < 0.35
            if after_arrival and arrived < TODAY:
                event_date = random_weekday(randomiser, arrived, TODAY)
            else:
                event_date = random_weekday(
                    randomiser, START_DATE - datetime.timedelta(days=60), arrived
                )
            signal_type = randomiser.choices(
                ["round_announced", "senior_hire", "traction_update", "news"], weights=[1, 2, 2, 2]
            )[0]
            lead_investor = ""
            if signal_type == "round_announced":
                lead_investor = randomiser.choice(COMPETITOR_FUNDS)
                description = f"Announced {profile['stage']} round led by {lead_investor}"
            else:
                description = randomiser.choice(descriptions[signal_type])
            signals.append(
                {
                    "company_name": profile["company_name"],
                    "website": f"https://{profile['domain']}",
                    "signal_type": signal_type,
                    "event_date": event_date.isoformat(),
                    "description": description,
                    "lead_investor": lead_investor,
                }
            )
    signals.sort(key=lambda signal: (signal["event_date"], signal["company_name"]))
    for number, signal in enumerate(signals, start=1):
        signal["signal_id"] = f"S{number:04d}"
    return signals


def write_csv(path: Path, columns: list[str], rows: list[dict]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    randomiser = random.Random(SEED)
    records, profiles = build_inbound(randomiser)
    signals = build_signals(randomiser, records, profiles)
    write_csv(INBOUND_PATH, INBOUND_COLUMNS, records)
    write_csv(SIGNALS_PATH, SIGNAL_COLUMNS, signals)
    warm_intros = sum(1 for record in records if record["channel"] == "warm_intro")
    print(
        f"Wrote {len(records)} inbound records ({warm_intros} warm intros) to {INBOUND_PATH.name}"
    )
    print(f"Wrote {len(signals)} signals to {SIGNALS_PATH.name}")


if __name__ == "__main__":
    main()
