"""The priority matrix: every open, filter-passing deal on score % × urgency.

Four quadrants (Act now · Plan a deep dive · Reply fast · Park or pass) split at the
lines in ``config/weights.yaml`` → ``matrix``. Each bubble is a company: position is
score and urgency, size is the number of touchpoints, and shape and colour both show
the source (warm intro or cold), so identity never rests on colour alone. Clicking a
bubble opens the deal.
"""

import html

import altair as alt
import pandas as pd
import streamlit as st

from _dashboard_cockpit import TEAM, cockpit_lines, inject_cockpit_style
from _dashboard_widgets import go_to, remember_deal_list, show_flash
from Uploads._triage_config import demo_today, load_triage_config
from Uploads._urgency import QUADRANTS, quadrant, rank_by_priority

WARM = "#C8102E"  # Skarv red; validated as a pair with COLD (CVD ΔE 21.9)
COLD = "#1F5FB8"
INK = "#16161a"
MUTED = "#5f5b55"
QUADRANT_ORDER = ["act_now", "plan", "reply_fast", "park"]

MATRIX_CSS = """
<style>
.st-key-mx-owner { max-width:320px; }
.mx-eyebrow { color:#c8102e; font-weight:600; letter-spacing:.18em; text-transform:uppercase; font-size:13px; }
[class*="st-key-quad-"] { position:relative; border:1px solid #e2ddd5; border-radius:8px; background:#fff;
                          padding:12px 14px; min-height:92px; }
[class*="st-key-quad-"][class*="-on"] { background:#16161a; border-color:#16161a; }
[class*="st-key-quad-"][class*="-on"] .mx-quad-name, [class*="st-key-quad-"][class*="-on"] .mx-quad-help { color:#fff; }
.mx-quad { display:flex; gap:12px; align-items:flex-start; }
.mx-quad-count { font-family:'Anton','Impact',sans-serif; font-size:38px; line-height:1; color:#c8102e; min-width:44px; }
.mx-quad-name { font-weight:700; color:#16161a; font-size:16px; }
.mx-quad-help { color:#5f5b55; font-size:13.5px; line-height:1.35; margin-top:2px; }
[class*="st-key-qb-"] { position:absolute !important; inset:0; width:100% !important; margin:0; z-index:2; }
[class*="st-key-qb-"] .stButton, [class*="st-key-qb-"] button { width:100%; height:100%; }
[class*="st-key-qb-"] button { opacity:0; cursor:pointer; }
[class*="st-key-quad-"]:has(button:focus-visible) { outline:3px solid #f2b705; outline-offset:2px; }
.mx-legend { display:flex; flex-wrap:wrap; gap:18px; color:#2b2a28; font-size:14px; margin:4px 0 2px; }
.mx-legend span { display:inline-flex; align-items:center; gap:6px; }
[class*="st-key-mx-row-"] { border-bottom:1px solid #e2ddd5; padding:6px 0; }
[class*="st-key-mx-row-"] [data-testid="stMarkdownContainer"], [class*="st-key-mx-row-"] [data-testid="stMarkdownContainer"] p { margin:0 !important; }
[class*="st-key-mxco-"] button { padding:0 !important; min-height:0 !important; }
[class*="st-key-mxco-"] button p { font-weight:700 !important; color:#16161a; }
.mx-cell { color:#2b2a28; font-size:14.5px; line-height:1.35; font-variant-numeric:tabular-nums; }
.mx-cell.num { text-align:right; }
</style>
"""


def spread(company_id: int, salt: int, width: float) -> float:
    """A small, fixed offset per company so points on the same value stay visible."""
    return ((company_id * salt) % 11 - 5) / 5 * width


def matrix_frame(lines: list) -> pd.DataFrame:
    rows = []
    for line in lines:
        company = line.company
        warm = any(touchpoint.channel == "warm_intro" for touchpoint in company.touchpoints.all())
        rows.append(
            {
                "company_id": company.pk,
                "Company": company.name,
                "Score %": line.score_percent,
                "Urgency": line.urgency,
                "x": line.score_percent + spread(company.pk, 37, 1.6),
                "y": line.urgency + spread(company.pk, 53, 2.4),
                "Touchpoints": company.touchpoint_count,
                "Source": "Warm intro" if warm else "Cold inbound",
                "Quadrant": QUADRANTS[quadrant(line.score_percent, line.urgency)][0],
                "quadrant_key": quadrant(line.score_percent, line.urgency),
                "Next action": line.next_action,
                "Owner": company.owner,
                "Priority": line.priority,
            }
        )
    return pd.DataFrame(rows)


def matrix_chart(frame: pd.DataFrame, labelled_ids: set[int]) -> alt.LayerChart:
    splits = load_triage_config()["matrix"]
    score_split, urgency_split = splits["score_split"], splits["urgency_split"]
    x_max = max(60, int(frame["Score %"].max()) + 8)
    x_scale = alt.Scale(domain=[0, x_max], nice=False)
    y_scale = alt.Scale(domain=[20, 104], nice=False)

    bands = pd.DataFrame(
        [
            {"x": score_split, "x2": x_max, "y": urgency_split, "y2": 104, "fill": "#f7e1e4"},
            {"x": score_split, "x2": x_max, "y": 20, "y2": urgency_split, "fill": "#eef1f6"},
            {"x": 0, "x2": score_split, "y": urgency_split, "y2": 104, "fill": "#f6efe6"},
            {"x": 0, "x2": score_split, "y": 20, "y2": urgency_split, "fill": "#f3f1ed"},
        ]
    )
    background = (
        alt.Chart(bands)
        .mark_rect(opacity=0.9)
        .encode(
            x=alt.X("x:Q", scale=x_scale),
            x2="x2:Q",
            y=alt.Y("y:Q", scale=y_scale),
            y2="y2:Q",
            color=alt.Color("fill:N", scale=None, legend=None),
        )
    )
    corner_labels = pd.DataFrame(
        [
            {"x": x_max - 1, "y": 102, "text": "ACT NOW", "align": "right", "baseline": "top"},
            {
                "x": x_max - 1,
                "y": 22,
                "text": "PLAN A DEEP DIVE",
                "align": "right",
                "baseline": "bottom",
            },
            {"x": 1, "y": 102, "text": "REPLY FAST", "align": "left", "baseline": "top"},
            {"x": 1, "y": 22, "text": "PARK OR PASS", "align": "left", "baseline": "bottom"},
        ]
    )
    corners = alt.layer(
        *[
            alt.Chart(corner_labels.iloc[[index]])
            .mark_text(
                align=label["align"],
                baseline=label["baseline"],
                fontSize=13,
                fontWeight=700,
                color=MUTED,
            )
            .encode(x=alt.X("x:Q", scale=x_scale), y=alt.Y("y:Q", scale=y_scale), text="text:N")
            for index, label in corner_labels.iterrows()
        ]
    )
    split_lines = alt.layer(
        alt.Chart(pd.DataFrame({"x": [score_split]}))
        .mark_rule(color=INK, strokeDash=[4, 4], strokeWidth=1.5)
        .encode(x=alt.X("x:Q", scale=x_scale)),
        alt.Chart(pd.DataFrame({"y": [urgency_split]}))
        .mark_rule(color=INK, strokeDash=[4, 4], strokeWidth=1.5)
        .encode(y=alt.Y("y:Q", scale=y_scale)),
    )

    pick = alt.selection_point(name="pick", fields=["company_id"], on="click")
    points = (
        alt.Chart(frame)
        .mark_point(filled=True, opacity=0.85, stroke="#fbfaf8", strokeWidth=1.5)
        .encode(
            x=alt.X(
                "x:Q", scale=x_scale, title="Score % (fit)", axis=alt.Axis(grid=False, tickCount=6)
            ),
            y=alt.Y("y:Q", scale=y_scale, title="Urgency", axis=alt.Axis(grid=False, tickCount=5)),
            size=alt.Size(
                "Touchpoints:Q",
                scale=alt.Scale(domain=[1, 5], range=[90, 520]),
                legend=alt.Legend(
                    title="Touchpoints",
                    orient="bottom",
                    values=[1, 2, 3, 4, 5],
                    symbolFillColor="#9a948c",
                    symbolStrokeColor="#9a948c",
                ),
            ),
            shape=alt.Shape(
                "Source:N",
                scale=alt.Scale(
                    domain=["Warm intro", "Cold inbound"], range=["triangle-up", "circle"]
                ),
                legend=None,
            ),
            color=alt.Color(
                "Source:N",
                scale=alt.Scale(domain=["Warm intro", "Cold inbound"], range=[WARM, COLD]),
                legend=None,
            ),
            tooltip=[
                alt.Tooltip("Company:N"),
                alt.Tooltip("Quadrant:N"),
                alt.Tooltip("Score %:Q"),
                alt.Tooltip("Urgency:Q"),
                alt.Tooltip("Touchpoints:Q"),
                alt.Tooltip("Source:N"),
                alt.Tooltip("Next action:N"),
                alt.Tooltip("Owner:N"),
            ],
        )
        .add_params(pick)
    )
    labelled = frame[frame["company_id"].isin(labelled_ids)].sort_values("x").reset_index(drop=True)
    labels = alt.layer(
        *[
            alt.Chart(labelled.iloc[offset::2])
            .mark_text(align="left", dx=9, dy=dy, fontSize=12, fontWeight=600, color=INK)
            .encode(x=alt.X("x:Q", scale=x_scale), y=alt.Y("y:Q", scale=y_scale), text="Company:N")
            for offset, dy in ((0, -9), (1, 11))
        ]
    )
    return (
        alt.layer(background, split_lines, corners, points, labels)
        .properties(height=520)
        .configure_view(stroke="#e2ddd5")
        .configure_axis(
            labelColor=MUTED,
            titleColor=INK,
            domainColor="#c9c3ba",
            tickColor="#c9c3ba",
            labelFontSize=12,
            titleFontSize=13,
        )
        .configure_legend(labelColor=INK, titleColor=INK)
    )


def quadrant_tiles(frame: pd.DataFrame, selected: str) -> None:
    first_row, second_row = st.columns(2), st.columns(2)
    slots = {
        "reply_fast": first_row[0],
        "act_now": first_row[1],
        "park": second_row[0],
        "plan": second_row[1],
    }
    for key in QUADRANT_ORDER:
        name, help_text = QUADRANTS[key]
        count = int((frame["quadrant_key"] == key).sum()) if not frame.empty else 0
        state = "-on" if key == selected else ""
        with slots[key].container(key=f"quad-{key}{state}"):
            st.markdown(
                f'<div class="mx-quad"><span class="mx-quad-count">{count}</span><div>'
                f'<div class="mx-quad-name">{html.escape(name)}</div>'
                f'<div class="mx-quad-help">{html.escape(help_text)}</div></div></div>',
                unsafe_allow_html=True,
            )
            if st.button(f"Show {name}", key=f"qb-{key}"):
                st.session_state["mx_quadrant"] = None if selected == key else key
                st.rerun()


def quadrant_list(frame: pd.DataFrame, selected: str | None) -> None:
    shown = frame if not selected else frame[frame["quadrant_key"] == selected]
    shown = shown.sort_values(["Priority", "Score %"], ascending=False)
    title = QUADRANTS[selected][0] if selected else "All deals on the matrix"
    remember_deal_list(f"Matrix: {title}", shown["company_id"].tolist())
    st.markdown(f"**{title}** · {len(shown)} deals · highest priority first")
    widths = [1.6, 0.7, 0.7, 0.8, 1.3, 2.2]
    header = st.columns(widths)
    for column, label in zip(
        header, ["Company", "Score", "Urgency", "Touch­points", "Source", "Next action"], strict=True
    ):
        column.markdown(f"**{label}**")
    for row in shown.head(30).to_dict("records"):
        company_id = int(row["company_id"])
        with st.container(key=f"mx-row-{company_id}"):
            columns = st.columns(widths, vertical_alignment="center")
            columns[0].button(
                row["Company"],
                key=f"mxco-{company_id}",
                type="tertiary",
                on_click=go_to,
                args=("Deal detail", company_id),
            )
            cells = [
                (row["Score %"], " num"),
                (row["Urgency"], " num"),
                (row["Touchpoints"], " num"),
                (row["Source"], ""),
                (row["Next action"], ""),
            ]
            for column, (value, extra) in zip(columns[1:], cells, strict=True):
                column.markdown(
                    f'<div class="mx-cell{extra}">{html.escape(str(value))}</div>',
                    unsafe_allow_html=True,
                )
    if len(shown) > 30:
        st.caption(
            f"Showing the first 30 of {len(shown)}. Pick a quadrant above to narrow the list."
        )


def priority_matrix(person: str) -> None:
    inject_cockpit_style()
    st.markdown(MATRIX_CSS, unsafe_allow_html=True)
    st.markdown('<div class="mx-eyebrow">Score × urgency</div>', unsafe_allow_html=True)
    st.markdown(
        '<h1 class="ck-title" style="font-size:56px">Priority matrix</h1>', unsafe_allow_html=True
    )
    st.markdown(
        '<p class="ck-lede">Every open deal that passed the hard filters, placed by fit and urgency. '
        "Time in queue is not part of either axis.</p>",
        unsafe_allow_html=True,
    )
    show_flash()

    today = demo_today()
    lines = [
        line
        for line in cockpit_lines(today)
        if line.company.status == "open" and line.company.passed_hard_filters
    ]
    with st.container(key="mx-owner"):
        owner = st.selectbox("Deals owned by", ["Whole team", *TEAM], key="mx_owner")
    if owner != "Whole team":
        lines = [line for line in lines if line.company.owner == owner]
    frame = matrix_frame(lines)
    if frame.empty:
        st.info("No open deals for this owner.")
        return

    selected = st.session_state.get("mx_quadrant")
    quadrant_tiles(frame, selected)

    st.markdown(
        '<div class="mx-legend">'
        f'<span><span style="color:{WARM}">▲</span> Warm intro</span>'
        f'<span><span style="color:{COLD}">●</span> Cold inbound</span>'
        "<span>Bubble size = touchpoints</span>"
        "<span>Dashed lines = quadrant splits</span>"
        "<span>Click a bubble to open the deal</span></div>",
        unsafe_allow_html=True,
    )
    top_ids = {line.company.pk for line in rank_by_priority(lines)[:6]}
    # A fresh key after each jump clears the click, so returning does not reopen the deal.
    chart_version = st.session_state.get("mx_chart_version", 0)
    event = st.altair_chart(
        matrix_chart(frame, top_ids),
        width="stretch",
        on_select="rerun",
        key=f"mx_chart_{chart_version}",
    )
    picked = (event or {}).get("selection", {}).get("pick") or []
    if picked:
        company_id = int(picked[0]["company_id"])
        remember_deal_list(
            "Priority matrix", frame.sort_values("Priority", ascending=False)["company_id"].tolist()
        )
        st.session_state["mx_chart_version"] = chart_version + 1
        go_to("Deal detail", company_id)
        st.rerun()
    st.caption(
        "Points on the same value are spread slightly so none hide behind another; the tooltip "
        "shows the exact score and urgency. The six highest-priority deals are labelled."
    )
    quadrant_list(frame, selected)
