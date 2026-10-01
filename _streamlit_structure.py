"""Streamlit entry point — the Skarv Ventures deal-flow triage dashboard (spec §9).

The Lex Streamlit host (``python -m lex streamlit``) calls :func:`main`. Pages live in
``_dashboard_pages.py`` and shared pieces in ``_dashboard_widgets.py``. UI text is British
English, and status is always a text label (with an icon), never colour alone.
"""

import streamlit as st

TEAM = [
    "Astrid Holm",
    "Jonas Weber",
    "Mette Lund",
    "Lukas Brandt",
    "Sofie Nygaard",
    "Emil Karlsson",
    "Lea Hoffmann",
]
PAGES = [
    "Cockpit",
    "Priority matrix",
    "Deal detail",
    "Intro tracker",
    "Merge queue",
    "Outbox",
    "Audit log",
]
PAGE_ICONS = {
    "Cockpit": "🎛️",
    "Priority matrix": "🧭",
    "Deal detail": "🔎",
    "Intro tracker": "🤝",
    "Merge queue": "🔀",
    "Outbox": "📤",
    "Audit log": "🧾",
}


def acting_person() -> str:
    """Who is clicking. The signed-in Lex user when there is one; otherwise, in the local
    demo without sign-in, the team member chosen in the sidebar."""
    signed_in = st.session_state.get("user_username") or st.session_state.get("user_email")
    if signed_in:
        st.sidebar.caption(f"Signed in as **{signed_in}**")
        return signed_in
    chosen = st.sidebar.selectbox(
        "Acting as (demo, not signed in)",
        TEAM,
        key="acting_person",
        help="Every decision is logged under this name.",
    )
    return f"{chosen} (demo)"


def navigation_counts() -> dict[str, int]:
    """Open work per page, shown next to its name in the sidebar."""
    from _dashboard_widgets import intro_states
    from Inputs.MergeSuggestion import MergeSuggestion

    return {
        "Intro tracker": sum(1 for intro, _ in intro_states() if intro.intro_status == "open"),
        "Merge queue": MergeSuggestion.objects.filter(status="pending").count(),
    }


def main() -> None:
    import _dashboard_cockpit as cockpit
    import _dashboard_matrix as matrix
    import _dashboard_pages as pages

    pages_by_name = {
        "Cockpit": cockpit.cockpit,
        "Priority matrix": matrix.priority_matrix,
        "Deal detail": pages.deal_detail,
        "Intro tracker": pages.intro_tracker,
        "Merge queue": pages.merge_queue,
        "Outbox": pages.outbox,
        "Audit log": pages.audit_log,
    }
    st.session_state.setdefault("page", "Cockpit")
    if "next_page" in st.session_state:
        st.session_state["page"] = st.session_state.pop("next_page")
    if st.session_state["page"] not in PAGES:
        st.session_state["page"] = "Cockpit"
    st.sidebar.markdown("## Skarv Ventures")
    st.sidebar.caption("Deal-flow triage · fictional demo data")
    counts = navigation_counts()
    st.sidebar.radio(
        "Go to",
        PAGES,
        key="page",
        format_func=lambda name: (
            f"{PAGE_ICONS[name]} {name}" + (f" · {counts[name]}" if counts.get(name) else "")
        ),
    )
    st.sidebar.divider()
    person = acting_person()
    pages_by_name[st.session_state["page"]](person)
