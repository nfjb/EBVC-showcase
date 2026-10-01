"""The Monday cockpit: one list of every company, its open tasks and the next step.

Four views (My view, Team view, Pipeline, Hot topics) in a dark tab bar, five KPI tiles
that double as quick filters, and the priority table ranked by score % × urgency.
Urgency never includes time in queue. Status is always written out: red marks what is
urgent, and the words on the pill say why.
"""

import datetime
import html
from functools import lru_cache

import pandas as pd
import streamlit as st

from _dashboard_pages import intro_reply_dialog, pass_dialog
from _dashboard_widgets import (
    PASS_CODE_LABELS,
    go_to,
    remember_deal_list,
    responsible_partners,
    show_flash,
)
from Uploads._triage_config import PROJECT_ROOT, demo_today, load_triage_config
from Uploads._urgency import build_line, rank_by_priority
from Uploads._working_days import ESCALATED

TEAM = [
    "Astrid Holm",
    "Jonas Weber",
    "Mette Lund",
    "Lukas Brandt",
    "Sofie Nygaard",
    "Emil Karlsson",
    "Lea Hoffmann",
]
VIEWS = ["My view", "Team view", "Pipeline", "Hot topics"]
TILES = {
    "top": "My top 20",
    "new": "Unreviewed new startups",
    "intros": "Warm intros due",
    "drafts": "Drafts to approve",
    "tracking": "Tracking > 3 months",
}

COCKPIT_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap');
:root { --ck-ink:#16161a; --ck-red:#c8102e; --ck-paper:#f4f2ee; --ck-sheet:#fbfaf8;
        --ck-line:#e2ddd5; --ck-muted:#5f5b55; --ck-chip:#e9e5df; }
.stApp, .stApp p, .stApp label, .stApp button { font-family:'Inter', system-ui, sans-serif; }
.stApp h1.ck-title { font-family:'Anton', 'Impact', sans-serif !important; font-weight:400 !important; padding:0 !important; font-size:clamp(40px,6vw,76px); line-height:.95;
            letter-spacing:.01em; color:var(--ck-ink); text-transform:uppercase; margin:0; }
.ck-kicker { color:var(--ck-red); font-weight:600; letter-spacing:.22em; font-size:14px;
             text-transform:uppercase; margin:10px 0 4px; }
.ck-lede { color:var(--ck-muted); font-style:italic; font-size:18px; margin:0 0 18px; }
.st-key-ck-bar { background:var(--ck-ink); border-radius:12px 12px 0 0; padding:10px 18px; margin-bottom:-16px; }
.st-key-ck-bar button[data-variant="segmented_control"] {
  border-radius:999px !important; border:1px solid #4a4a52 !important; background:transparent !important;
  color:#f4f2ee !important; font-weight:600; }
.st-key-ck-bar button[data-variant="segmented_control"][aria-checked="true"] {
  background:var(--ck-red) !important; border-color:var(--ck-red) !important; color:#fff !important; }
.ck-live { color:#f4f2ee; text-align:right; font-size:15px; line-height:38px; }
.st-key-ck-bar [data-testid="stMarkdownContainer"], .st-key-ck-bar [data-testid="stMarkdownContainer"] p { margin:0 !important; }
.ck-live .dot { color:#3ecf6e; }
.st-key-ck-sheet { background:var(--ck-sheet); border:1px solid var(--ck-line); border-top:0;
                   border-radius:0 0 12px 12px; padding:20px 20px 12px; box-shadow:0 8px 24px rgba(22,22,26,.06); }
[class*="st-key-tile-"] { position:relative; border:1px solid var(--ck-line); border-radius:8px;
                          background:#fff; padding:10px 14px; min-height:66px; }
[class*="st-key-tile-"][class*="-on"] { background:var(--ck-ink); border-color:var(--ck-ink); }
[class*="st-key-tile-"][class*="-on"] .ck-tile-label { color:#fff; }
.ck-tile { display:flex; align-items:center; gap:12px; }
.ck-tile-number { font-family:'Anton','Impact',sans-serif; font-size:40px; line-height:1; color:var(--ck-red); }
.ck-tile-number.quiet { color:var(--ck-ink); }
[class*="-on"] .ck-tile-number.quiet { color:#fff; }
.ck-tile-label { font-size:16px; line-height:1.2; color:var(--ck-ink); }
[class*="st-key-tb-"] { position:absolute !important; inset:0; width:100% !important; margin:0; z-index:2; }
[class*="st-key-tb-"] .stButton, [class*="st-key-tb-"] button { width:100%; height:100%; }
[class*="st-key-tb-"] button { opacity:0; cursor:pointer; }
[class*="st-key-tile-"]:has(button:focus-visible) { outline:3px solid #f2b705; outline-offset:2px; }
.ck-list-head { display:flex; justify-content:space-between; align-items:baseline; margin:14px 0 4px; }
.ck-list-title { font-weight:700; letter-spacing:.06em; text-transform:uppercase; font-size:16px; color:var(--ck-ink); }
.ck-hint { color:var(--ck-muted); font-style:italic; font-size:14px; }
.ck-th { font-weight:700; font-size:15px; color:var(--ck-ink); white-space:nowrap; }
.st-key-ck-head { border-bottom:2px solid var(--ck-ink); padding:4px 0 8px; }
.st-key-ck-head [data-testid="stMarkdownContainer"] p, .st-key-ck-head .ck-th { margin:0; line-height:1.4; }
.st-key-ck-viewer { max-width:320px; }
.ck-th.num { text-align:right; }
[class*="st-key-ck-row-"] { border-bottom:1px solid var(--ck-line); padding:7px 0; gap:0; }
[class*="st-key-ck-row-"] [data-testid="stHorizontalBlock"], .st-key-ck-head [data-testid="stHorizontalBlock"] { gap:.75rem; }
/* Streamlit gives every markdown cell a -16px bottom margin and every paragraph a 16px one;
   inside the table that shifts cells off the row's centre line, so both are reset. */
[class*="st-key-ck-row-"] [data-testid="stMarkdownContainer"],
[class*="st-key-ck-row-"] [data-testid="stMarkdownContainer"] p,
.st-key-ck-head [data-testid="stMarkdownContainer"],
.st-key-ck-head [data-testid="stMarkdownContainer"] p { margin:0 !important; }
[class*="st-key-ck-row-"] [data-testid="stColumn"], .st-key-ck-head [data-testid="stColumn"] { margin:0 !important; }
.ck-desc { line-height:1.35; }
.ck-desc small { display:block; margin-top:2px; line-height:1.3; }
.ck-num, .ck-rank, .ck-tasks-cell { line-height:28px; }
.ck-rank { display:block; color:var(--ck-muted); font-variant-numeric:tabular-nums; white-space:nowrap; text-align:right; padding-right:4px; }
.ck-th.rank { text-align:right; padding-right:4px; }
.ck-desc { color:#2b2a28; }
.ck-desc small { color:var(--ck-muted); }
.ck-num { text-align:right; font-variant-numeric:tabular-nums; font-size:16px; }
.ck-num.hot { color:var(--ck-red); font-weight:700; }
.ck-badge { display:inline-flex; align-items:center; justify-content:center; min-width:28px; height:24px;
            padding:0 8px; border-radius:999px; background:var(--ck-chip); color:var(--ck-ink); font-weight:700; }
.ck-badge.hot { background:var(--ck-red); color:#fff; }
.ck-tasks-cell { text-align:center; }
[class*="st-key-co-"] button { padding:0 !important; min-height:0 !important; font-weight:700 !important;
                               color:var(--ck-ink) !important; font-size:16px !important; text-align:left; }
[class*="st-key-co-"] button p { font-weight:700 !important; font-size:16px !important; }
[class*="st-key-co-"] button:hover { color:var(--ck-red) !important; text-decoration:underline; }
[class*="st-key-pill-"] button { border-radius:999px !important; border:0 !important; min-height:0 !important;
                                 padding:3px 14px !important; font-weight:600 !important; white-space:nowrap; }
[class*="st-key-pill-"] button p { font-size:14px !important; }
.ck-assignee { line-height:1.3; }
.ck-assignee .who { font-weight:700; color:var(--ck-ink); font-size:15px; }
.ck-assignee .role { color:var(--ck-muted); font-size:13px; font-weight:400; }
.ck-assignee .step { display:block; font-size:13px; color:#2b2a28; margin-top:2px; }
.ck-assignee .step.hot { color:var(--ck-red); font-weight:600; }
.st-key-ck-bar button[data-variant="segmented_control"] { margin-right:8px; }
.st-key-ck-bar [role="radiogroup"] { gap:8px; }
[class*="st-key-pill-hot-"] button { background:var(--ck-red) !important; color:#fff !important; }
[class*="st-key-pill-calm-"] button { background:var(--ck-ink) !important; color:#fff !important; }
[class*="st-key-pill-"] button:focus-visible { outline:3px solid #f2b705 !important; outline-offset:2px; }
</style>
"""


def inject_cockpit_style() -> None:
    st.markdown(COCKPIT_CSS, unsafe_allow_html=True)


# ── data ──────────────────────────────────────────────────────────────────────────


def cockpit_lines(today: datetime.date) -> list:
    """One line per company, with its open tasks, next action and priority."""
    from Inputs.Company import Company
    from Inputs.MergeSuggestion import MergeSuggestion
    from Inputs.OutboxMessage import OutboxMessage

    pending_merge_ids = set()
    for company_id, candidate_id in MergeSuggestion.objects.filter(status="pending").values_list(
        "company_id", "candidate_id"
    ):
        pending_merge_ids.update((company_id, candidate_id))
    pass_reply_sent_ids = set(
        OutboxMessage.objects.filter(kind="pass")
        .exclude(company=None)
        .values_list("company_id", flat=True)
    )
    companies = Company.objects.prefetch_related("touchpoints")
    return [
        build_line(company, today, frozenset(pending_merge_ids), frozenset(pass_reply_sent_ids))
        for company in companies
    ]


def tile_filters(lines: list, today: datetime.date) -> dict[str, list]:
    config = load_triage_config()
    new_days = config["cockpit"]["new_startup_days"]
    tracking_days = config["cockpit"]["long_tracking_days"]
    open_passing = [
        line for line in lines if line.company.status == "open" and line.company.passed_hard_filters
    ]
    return {
        "top": rank_by_priority(open_passing)[: config["worklist_size"]],
        "new": rank_by_priority(
            [
                line
                for line in open_passing
                if line.days_in_queue <= new_days and "Rate thesis, market and team" in line.tasks
            ]
        ),
        "intros": rank_by_priority([line for line in lines if line.intro_state is not None]),
        "drafts": rank_by_priority([line for line in lines if "Approve pass draft" in line.tasks]),
        "tracking": rank_by_priority(
            [line for line in open_passing if line.days_in_queue > tracking_days]
        ),
    }


# ── pieces ────────────────────────────────────────────────────────────────────────


def header(today: datetime.date) -> None:
    st.markdown(
        '<h1 class="ck-title">The Monday Cockpit</h1>'
        f'<div class="ck-kicker">Skarv Ventures · deal-flow triage · {today:%a} {today.day} {today:%b %Y}</div>'
        '<p class="ck-lede">One list: every company, its open tasks, the next step.</p>',
        unsafe_allow_html=True,
    )


def tab_bar() -> str:
    if not st.session_state.get("ck_view"):
        st.session_state["ck_view"] = "My view"
    with st.container(key="ck-bar"):
        tabs, live = st.columns([4, 1.4], vertical_alignment="center")
        view = tabs.segmented_control(
            "View",
            VIEWS,
            key="ck_view",
            label_visibility="collapsed",
        )
        live.markdown(
            '<div class="ck-live"><span class="dot">●</span> Demo Data</div>',
            unsafe_allow_html=True,
        )
    return view or "My view"


def kpi_tiles(filters: dict[str, list], selected: str, view: str) -> None:
    labels = dict(TILES, top="My top 20" if view == "My view" else "Team top 20")
    columns = st.columns(len(labels))
    for column, (tile, label) in zip(columns, labels.items(), strict=True):
        count = len(filters[tile])
        quiet = tile in ("drafts", "tracking")
        state = "-on" if tile == selected else ""
        with column.container(key=f"tile-{tile}{state}"):
            st.markdown(
                f'<div class="ck-tile"><span class="ck-tile-number{" quiet" if quiet else ""}">{count}</span>'
                f'<span class="ck-tile-label">{html.escape(label)}</span></div>',
                unsafe_allow_html=True,
            )
            if st.button(f"Show {label}", key=f"tb-{tile}"):
                st.session_state["ck_tile"] = tile
                st.rerun()


PAGE_SIZE = 30
ROW_WIDTHS = [0.42, 1.4, 3.1, 0.55, 0.7, 0.85, 2.4]


def table_header(actionable: bool = True) -> None:
    columns = st.container(key="ck-head").columns(ROW_WIDTHS)
    for column, (label, numeric) in zip(
        columns,
        [
            ("#", False),
            ("Company", False),
            ("Description", False),
            ("Score", True),
            ("Urgency", True),
            ("Open tasks", False),
            ("Next action" if actionable else "Assigned to · next step", False),
        ],
        strict=True,
    ):
        extra = " num" if numeric else (" rank" if label == "#" else "")
        column.markdown(f'<div class="ck-th{extra}">{label}</div>', unsafe_allow_html=True)


@lru_cache(maxsize=1)
def team_roles() -> dict[str, str]:
    import yaml

    with open(PROJECT_ROOT / "config" / "team.yaml", encoding="utf-8") as team_file:
        return {member["name"]: member["role"] for member in yaml.safe_load(team_file)["team"]}


def assignee_cell(line) -> str:
    """Who owns the next step, what it is, and who it has escalated to — for chasing, not acting."""
    owner = line.company.owner or "Unassigned"
    role = team_roles().get(owner, "")
    step = line.next_action
    hot = line.urgent
    if line.intro_state and line.intro_state["past_deadline"]:
        step = f"⚠ {step}"
    if line.intro_state and line.intro_state["escalation"] == ESCALATED:
        partner = responsible_partners().get(owner, owner)
        if partner != owner:
            step += f" · escalated to {partner}"
    role_text = f' <span class="role">· {html.escape(role.capitalize())}</span>' if role else ""
    return (
        f'<div class="ck-assignee"><span class="who">{html.escape(owner)}</span>{role_text}'
        f'<span class="step{" hot" if hot else ""}">{html.escape(step)}</span></div>'
    )


def run_next_action(line, person: str) -> None:
    if line.next_action_kind == "intro":
        intro_reply_dialog(line.intro, person)
    elif line.next_action_kind == "pass_draft":
        pass_dialog(line.company, person)
    elif line.next_action_kind == "merge":
        go_to("Merge queue")
        st.rerun()
    else:
        go_to("Deal detail", line.company.pk)
        st.rerun()


def table_row(rank: int, line, person: str, actionable: bool = True) -> None:
    company = line.company
    with st.container(key=f"ck-row-{company.pk}"):
        columns = st.columns(ROW_WIDTHS, vertical_alignment="center")
        pinned = " 📌" if company.rank_override else ""
        columns[0].markdown(f'<span class="ck-rank">{rank}{pinned}</span>', unsafe_allow_html=True)
        columns[1].button(
            company.name,
            key=f"co-{company.pk}",
            type="tertiary",
            on_click=go_to,
            args=("Deal detail", company.pk),
            help="Open the deal",
        )
        detail = (
            f"{company.stage} · {company.country}"
            + (
                f" · failed: {PASS_CODE_LABELS.get(company.pass_code, company.pass_code)}"
                if not company.passed_hard_filters
                else ""
            )
            + (f" · ⏳ {line.flag}" if line.flag and company.passed_hard_filters else "")
        )
        columns[2].markdown(
            f'<div class="ck-desc">{html.escape(company.one_liner)}<small>{html.escape(detail)}</small></div>',
            unsafe_allow_html=True,
        )
        columns[3].markdown(
            f'<div class="ck-num">{line.score_percent}</div>', unsafe_allow_html=True
        )
        hot = " hot" if line.urgency >= 80 else ""
        columns[4].markdown(
            f'<div class="ck-num{hot}">{line.urgency}</div>', unsafe_allow_html=True
        )
        badge_hot = " hot" if line.urgent else ""
        tasks_text = html.escape(", ".join(line.tasks) or "No open tasks")
        columns[5].markdown(
            f'<div class="ck-tasks-cell"><span class="ck-badge{badge_hot}" title="{tasks_text}" '
            f'aria-label="{len(line.tasks)} open tasks: {tasks_text}">{len(line.tasks)}</span></div>',
            unsafe_allow_html=True,
        )
        if not actionable:
            columns[6].markdown(assignee_cell(line), unsafe_allow_html=True)
            return
        pill_kind = "hot" if line.urgent else "calm"
        icon = "⚠ " if line.intro_state and line.intro_state["past_deadline"] else ""
        if columns[6].button(f"{icon}{line.next_action} →", key=f"pill-{pill_kind}-{company.pk}"):
            run_next_action(line, person)


def priority_table(title: str, lines: list, person: str, actionable: bool = True) -> None:
    st.markdown(
        f'<div class="ck-list-head"><span class="ck-list-title">{html.escape(title)} · score × urgency</span>'
        "</div>",
        unsafe_allow_html=True,
    )
    if not lines:
        st.markdown("✅ Nothing here right now.")
        return
    remember_deal_list(title, [line.company.pk for line in lines])
    table_header(actionable)
    limit = len(lines) if st.session_state.get("ck_show_all") else PAGE_SIZE
    for rank, line in enumerate(lines[:limit], start=1):
        table_row(rank, line, person, actionable)
    if len(lines) > PAGE_SIZE:
        st.caption(f"Showing {min(limit, len(lines))} of {len(lines)}.")
        st.toggle("Show all", key="ck_show_all")


def export_controls(title: str, lines: list, today: datetime.date) -> None:
    rows = [
        {
            "Rank": rank,
            "Company": line.company.name,
            "Website": line.company.website_domain,
            "Description": line.company.one_liner,
            "Stage": line.company.stage,
            "Country": line.company.country,
            "Score %": line.score_percent,
            "Urgency": line.urgency,
            "Open tasks": "; ".join(line.tasks),
            "Next action": line.next_action,
            "Days in queue": line.days_in_queue,
            "Owner": line.company.owner,
        }
        for rank, line in enumerate(lines, start=1)
    ]
    table = pd.DataFrame(rows)
    export, printable = st.columns([1, 4])
    export.download_button(
        "⬇ Export to CSV",
        table.to_csv(index=False).encode("utf-8"),
        file_name=f"skarv-{title.lower().replace(' ', '-')}-{today.isoformat()}.csv",
        mime="text/csv",
        disabled=table.empty,
    )
    with printable.expander("Print view for the Monday meeting"):
        st.caption("Print with Ctrl+P.")
        if not table.empty:
            st.table(table.drop(columns=["Website"]).set_index("Rank"))


# ── views ─────────────────────────────────────────────────────────────────────────


def viewer_name(person: str) -> str:
    """Whose deals 'My view' shows. Defaults to the acting person when they are on the team."""
    plain = person.removesuffix(" (demo)")
    default = TEAM.index(plain) if plain in TEAM else 0
    with st.container(key="ck-viewer"):
        return st.selectbox("Deals owned by", TEAM, index=default, key="ck_viewer")


def pipeline_view(lines: list) -> None:
    from Inputs.Touchpoint import Touchpoint

    passed = [line for line in lines if line.company.passed_hard_filters]
    columns = st.columns(4)
    columns[0].metric("Inbound records", Touchpoint.objects.count())
    columns[1].metric("Companies after merging", len(lines))
    columns[2].metric("Passed hard filters", len(passed))
    columns[3].metric(
        "Decided by the team", sum(1 for line in lines if line.company.status != "open")
    )
    left, right = st.columns(2)
    with left:
        st.markdown("**Why companies failed the hard filters**")
        failures = pd.Series(
            [
                PASS_CODE_LABELS.get(line.company.pass_code, line.company.pass_code)
                for line in lines
                if not line.company.passed_hard_filters
            ]
        ).value_counts()
        st.dataframe(
            failures.rename_axis("Reason").reset_index(name="Companies"),
            hide_index=True,
            width="stretch",
        )
    with right:
        st.markdown("**Inbound by channel**")
        channels = (
            pd.Series(Touchpoint.objects.values_list("channel", flat=True))
            .map(
                {
                    "website_form": "Website form",
                    "cold_email": "Cold email",
                    "linkedin": "LinkedIn",
                    "warm_intro": "Warm intro",
                }
            )
            .value_counts()
        )
        st.dataframe(
            channels.rename_axis("Channel").reset_index(name="Records"),
            hide_index=True,
            width="stretch",
        )


def hot_topics(lines: list, today: datetime.date, person: str) -> None:
    window = load_triage_config()["urgency"]["signal_days"]
    recent = [
        line
        for line in lines
        if line.company.latest_signal_at
        and (today - line.company.latest_signal_at).days <= window
        and line.company.status == "open"
    ]
    recent.sort(key=lambda line: line.company.latest_signal_at, reverse=True)
    remember_deal_list("Hot topics", [line.company.pk for line in recent])
    st.markdown(
        f'<div class="ck-list-head"><span class="ck-list-title">Hot topics · signals from the last {window} days</span>'
        '<span class="ck-hint">Hires, traction and news on open deals</span></div>',
        unsafe_allow_html=True,
    )
    if not recent:
        st.markdown("Nothing new in the window.")
        return
    for line in recent:
        with st.container(key=f"ck-row-hot-{line.company.pk}"):
            date_column, company_column, signal_column, action_column = st.columns(
                [0.9, 1.7, 4.3, 2.1], vertical_alignment="center"
            )
            date_column.markdown(
                f'<span class="ck-rank">{line.company.latest_signal_at:%d %b}</span>',
                unsafe_allow_html=True,
            )
            company_column.button(
                line.company.name,
                key=f"co-hot-{line.company.pk}",
                type="tertiary",
                on_click=go_to,
                args=("Deal detail", line.company.pk),
            )
            signal_column.markdown(
                f'<div class="ck-desc">{html.escape(line.company.latest_signal)}</div>',
                unsafe_allow_html=True,
            )
            action_column.markdown(assignee_cell(line), unsafe_allow_html=True)


def cockpit(person: str) -> None:
    inject_cockpit_style()
    today = demo_today()
    header(today)
    show_flash()
    lines = cockpit_lines(today)
    view = tab_bar()
    with st.container(key="ck-sheet"):
        if not lines:
            st.info(
                "No deals loaded yet. Upload `demo/inbound_records.csv` and `demo/signals.csv` as a Deal flow upload."
            )
            return
        if view == "Pipeline":
            pipeline_view(lines)
            return
        if view == "Hot topics":
            hot_topics(lines, today, person)
            return
        scope = lines
        if view == "My view":
            owner = viewer_name(person)
            scope = [line for line in lines if line.company.owner == owner]
        filters = tile_filters(scope, today)
        selected = st.session_state.get("ck_tile", "top")
        kpi_tiles(filters, selected, view)
        title = (
            "My top 20"
            if (view == "My view" and selected == "top")
            else ("Team top 20" if selected == "top" else TILES[selected])
        )
        # My view: act directly. Team view: see who owns each step, so it can be chased.
        priority_table(title, filters[selected], person, actionable=(view == "My view"))
        export_controls(title, filters[selected], today)
