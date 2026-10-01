"""Dashboard pages for ``_streamlit_structure.main()`` (spec §5, §9).

Each page takes ``person`` — the name every click is logged under. The pages are built
around what someone has to do next: the Cockpit lists what needs attention, and every
list links straight to the deal or queue that resolves it.
"""

import json

import pandas as pd
import streamlit as st

from _dashboard_widgets import (
    CHANNEL_LABELS,
    DECISION_LABELS,
    INTRO_LABELS,
    INTRODUCER_LABELS,
    PASS_CODE_LABELS,
    euros,
    go_to,
    intro_states,
    intro_urgency,
    long_date,
    maximum_score,
    page_header,
    queue_state,
    rating,
    remember_deal_list,
    responsible_partners,
    run_action,
)
from Uploads._replies import (
    ReplyDraft,
    intro_reply_draft,
    introducer_thanks_draft,
    pass_and_reply,
    pass_reply_draft,
    send_reply,
)
from Uploads._triage_actions import (
    PASS_CODES,
    ActionRefused,
    advance,
    approve_merge,
    override_rank,
    pass_deal,
    rank_worklist,
    reject_merge,
    save_ratings,
    set_intro_status,
)
from Uploads._triage_config import load_triage_config

EMPTY_CRM = (
    "No deals loaded yet. Run `python demo/_generate.py`, then create a **Deal flow upload** "
    "in the Lex app with `demo/inbound_records.csv` and `demo/signals.csv`."
)


# ── Deal detail ───────────────────────────────────────────────────────────────────


SIMULATED_NOTE = (
    "Simulated send: the message is stored in the Outbox and the audit log; "
    "no email leaves the app."
)


def edit_draft(draft: ReplyDraft, key: str) -> ReplyDraft:
    """Show a draft the person can edit before sending."""
    address = draft.recipient_address or "no address on file"
    st.caption(f"To: **{draft.recipient_name or '–'}** · {address}")
    subject = st.text_input("Subject", value=draft.subject, key=f"subject-{key}")
    body = st.text_area("Message", value=draft.body, height=230, key=f"body-{key}")
    return ReplyDraft(draft.kind, draft.recipient_name, draft.recipient_address, subject, body)


@st.dialog("Pass on this deal", width="large")
def pass_dialog(company, person: str) -> None:
    st.markdown(
        f"Passing on **{company.name}**. The decision and the reply are logged under your name."
    )
    default_code = company.pass_code if company.pass_code in PASS_CODES else PASS_CODES[0]
    pass_code = st.selectbox(
        "Reason",
        PASS_CODES,
        index=PASS_CODES.index(default_code),
        format_func=PASS_CODE_LABELS.get,
    )
    comment = st.text_input("Comment", placeholder="Required when the reason is 'Other'")
    try:
        draft = pass_reply_draft(company, pass_code, comment)
    except ActionRefused as refusal:
        st.info(str(refusal))
        return
    st.markdown("**Reply to the founder** (drafted from the template library, edit freely)")
    edited = edit_draft(draft, f"pass-{company.pk}-{pass_code}-{hash(comment)}")
    st.caption(SIMULATED_NOTE)
    send, without = st.columns(2)
    if send.button("⛔ Pass and send reply", type="primary", width="stretch"):
        run_action(
            pass_and_reply,
            company,
            pass_code,
            person,
            comment,
            edited,
            success=f"Passed on {company.name} and sent the reply (simulated).",
        )
    if without.button("Pass without a reply", width="stretch"):
        run_action(
            pass_deal,
            company,
            pass_code,
            person,
            comment=comment,
            success=f"Passed on {company.name}.",
        )


@st.dialog("Reply to the founder", width="large")
def intro_reply_dialog(intro, person: str) -> None:
    st.markdown(
        f"Warm intro from **{intro.introducer_name}** for **{intro.company.name}**. "
        "Sending marks the intro as replied."
    )
    edited = edit_draft(intro_reply_draft(intro), f"intro-{intro.pk}")
    st.caption(SIMULATED_NOTE)
    if st.button("✉️ Send reply", type="primary"):
        run_action(
            send_reply,
            intro.company,
            edited,
            person,
            intro=intro,
            success=f"Reply sent to the founder of {intro.company.name} (simulated).",
        )


@st.dialog("Thank the introducer", width="large")
def introducer_thanks_dialog(intro, person: str) -> None:
    st.markdown(f"Close the loop with **{intro.introducer_name}** about **{intro.company.name}**.")
    edited = edit_draft(introducer_thanks_draft(intro), f"thanks-{intro.pk}")
    st.caption(SIMULATED_NOTE)
    if st.button("🙏 Send thank-you", type="primary"):
        run_action(
            send_reply,
            intro.company,
            edited,
            person,
            success=f"Thank-you sent to {intro.introducer_name} (simulated).",
        )


DEAL_NAV_CSS = """
<style>
.st-key-deal-nav { border-bottom:1px solid #e2ddd5; padding-bottom:10px; margin-bottom:6px; }
.st-key-deal-nav [data-testid="stMarkdownContainer"], .st-key-deal-nav [data-testid="stMarkdownContainer"] p { margin:0 !important; }
.deal-crumb { color:#5f5b55; font-size:14px; line-height:38px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.deal-crumb b { color:#16161a; }
.deal-eyebrow { color:#c8102e; font-weight:600; letter-spacing:.18em; text-transform:uppercase; font-size:13px; margin-top:8px; }
</style>
"""


def step_to(company_id: int) -> None:
    """Button callback: show another deal from the same list."""
    st.session_state["selected_company_id"] = company_id


def jump_to() -> None:
    """Search callback: open the chosen deal and clear the search box."""
    chosen = st.session_state.get("deal_jump")
    if chosen is not None:
        st.session_state["selected_company_id"] = chosen


def deal_sequence(companies: list) -> tuple[str, list[int]]:
    """The list the deal was opened from; the team worklist when there is none."""
    ids = st.session_state.get("deal_sequence") or []
    known = {company.pk for company in companies}
    ids = [company_id for company_id in ids if company_id in known]
    if ids:
        return st.session_state.get("deal_sequence_title", "List"), ids
    return "Team top 20", [company.pk for company in rank_worklist(companies)][:20]


def deal_navigation(companies: list):
    """Back link, breadcrumb with position, previous / next, and a jump-to search."""
    st.markdown(DEAL_NAV_CSS, unsafe_allow_html=True)
    by_id = {company.pk: company for company in companies}
    list_title, sequence = deal_sequence(companies)
    selected_id = st.session_state.get("selected_company_id")
    if selected_id not in by_id:
        selected_id = sequence[0] if sequence else companies[0].pk
        st.session_state["selected_company_id"] = selected_id
    company = by_id[selected_id]
    position = sequence.index(company.pk) if company.pk in sequence else None
    return_page = st.session_state.get("deal_return_page", "Cockpit")

    with st.container(key="deal-nav"):
        back, crumb, previous, following, search = st.columns(
            [1.1, 2.6, 1, 1, 2.6], vertical_alignment="center"
        )
        back.button(
            f"← {return_page}",
            key="deal-back",
            on_click=go_to,
            args=(return_page,),
            help=f"Back to {return_page}",
        )
        where = f"{position + 1} of {len(sequence)}" if position is not None else "not in this list"
        crumb.markdown(
            f'<div class="deal-crumb">{return_page} › {list_title} · <b>{where}</b></div>',
            unsafe_allow_html=True,
        )
        has_previous = position is not None and position > 0
        has_next = position is not None and position < len(sequence) - 1
        previous.button(
            "‹ Previous",
            key="deal-previous",
            width="stretch",
            disabled=not has_previous,
            on_click=step_to,
            args=(sequence[position - 1] if has_previous else company.pk,),
            help=by_id[sequence[position - 1]].name if has_previous else None,
        )
        following.button(
            "Next ›",
            key="deal-next",
            width="stretch",
            disabled=not has_next,
            on_click=step_to,
            args=(sequence[position + 1] if has_next else company.pk,),
            help=by_id[sequence[position + 1]].name if has_next else None,
        )
        ordered = sorted(companies, key=lambda item: item.name.lower())
        st.session_state["deal_jump"] = None
        search.selectbox(
            "Jump to a deal",
            [item.pk for item in ordered],
            index=None,
            key="deal_jump",
            placeholder="Jump to a deal…",
            format_func=lambda company_id: (
                f"{by_id[company_id].name} · {by_id[company_id].website_domain or 'no website'}"
            ),
            on_change=jump_to,
            label_visibility="collapsed",
        )
    return company, (position + 1 if position is not None else None), list_title


def scroll_to_top_on_new_deal(company_id: int) -> None:
    """Start a newly opened deal at the top; Streamlit otherwise keeps the old scroll position."""
    if st.session_state.get("deal_shown_id") == company_id:
        return
    st.session_state["deal_shown_id"] = company_id
    import streamlit.components.v1 as components

    components.html(
        f"<script>/* deal {company_id} */"
        "const main = window.parent.document.querySelector('section.main, [data-testid=\"stMain\"]');"
        "if (main) { main.scrollTo({top: 0}); } window.parent.scrollTo({top: 0});</script>",
        height=0,
    )


def deal_detail(person: str) -> None:
    from Inputs.Company import Company

    companies = list(Company.objects.prefetch_related("touchpoints"))
    if not companies:
        page_header("Deal detail")
        st.info(EMPTY_CRM)
        return
    company, rank, list_title = deal_navigation(companies)
    scroll_to_top_on_new_deal(company.pk)
    waiting, flag = queue_state(company)

    st.markdown('<div class="deal-eyebrow">Deal detail</div>', unsafe_allow_html=True)
    page_header(company.name)
    st.markdown(
        f"{company.one_liner}  \n"
        f"{company.stage} · {euros(company.round_size_eur)} round · {company.country} · "
        f"owner **{company.owner}** · {company.website_domain or 'no website'}"
    )
    columns = st.columns(5)
    columns[0].metric("Decision", DECISION_LABELS[company.status])
    columns[1].metric(f"Rank in {list_title}", f"#{rank}" if rank else "–")
    columns[2].metric("Score", f"{company.score:.1f} / {maximum_score():.0f}")
    columns[3].metric("Days in queue", waiting)
    columns[4].metric("Touchpoints", company.touchpoint_count)
    if flag:
        st.warning(f"⏳ {flag} — {waiting} days in the queue.")
    if not company.passed_hard_filters:
        st.info(
            f"⛔ Failed the hard filters: {PASS_CODE_LABELS.get(company.pass_code, company.pass_code)}."
        )
    if company.latest_signal:
        st.caption(f"Latest signal: {company.latest_signal}")

    decide_tab, score_tab, history_tab, rank_tab = st.tabs(
        ["Decide", "Score breakdown", f"History ({company.touchpoint_count})", "Rank override"]
    )
    with decide_tab:
        decide_section(company, person)
    with score_tab:
        breakdown = pd.DataFrame(json.loads(company.score_breakdown or "[]"))
        if not breakdown.empty:
            breakdown["component"] = breakdown["component"].str.replace("_", " ").str.capitalize()
            breakdown["value"] = breakdown["value"].map(rating)
            st.dataframe(
                breakdown.rename(columns=str.capitalize),
                hide_index=True,
                width="stretch",
            )
        st.caption(
            "Time in queue is not a score component. Team and market are rated by people only."
        )
    with history_tab:
        history = pd.DataFrame(
            company.touchpoints.order_by("received_at").values(
                "received_at",
                "channel",
                "recipient",
                "company_name",
                "website",
                "introducer_name",
                "intro_status",
            )
        )
        history["channel"] = history["channel"].map(CHANNEL_LABELS)
        history["intro_status"] = history["intro_status"].map(
            lambda status: INTRO_LABELS.get(status, "")
        )
        st.dataframe(
            history.rename(
                columns={
                    "received_at": "Received",
                    "channel": "Channel",
                    "recipient": "Sent to",
                    "company_name": "Name used",
                    "website": "Website",
                    "introducer_name": "Introducer",
                    "intro_status": "Intro status",
                }
            ),
            hide_index=True,
            width="stretch",
        )
    with rank_tab:
        with st.form(f"override-{company.pk}"):
            pinned = st.number_input(
                "Pin to rank (0 removes the pin)",
                min_value=0,
                value=company.rank_override or 0,
            )
            reason = st.text_input("Why? (required, logged)")
            if st.form_submit_button("📌 Save override"):
                run_action(
                    override_rank,
                    company,
                    int(pinned) or None,
                    reason,
                    person,
                    success="Rank override saved.",
                )


def decide_section(company, person: str) -> None:
    left, right = st.columns([3, 2], gap="large")
    with left, st.form(f"ratings-{company.pk}", border=False):
        st.markdown("**Ratings** · 1 = weak, 2 = adequate, 3 = strong")
        suggested = "" if company.thesis_fit_confirmed else f" (suggested: {company.thesis_fit})"
        thesis_fit = st.segmented_control(
            f"Thesis fit{suggested}",
            [1, 2, 3],
            default=company.thesis_fit or 1,
        )
        market = st.segmented_control("Market", [1, 2, 3], default=company.market)
        team = st.segmented_control("Team", [1, 2, 3], default=company.team)
        if st.form_submit_button("Save ratings"):
            run_action(
                save_ratings,
                company,
                thesis_fit or company.thesis_fit or 1,
                market,
                team,
                person,
                success="Ratings saved; score updated.",
            )
    with right:
        st.markdown("**Decision**")
        if company.status != "open":
            st.markdown(f"Already {DECISION_LABELS[company.status]}.")
        advance_comment = st.text_input(
            "Comment for advancing (optional)", key=f"advance-comment-{company.pk}"
        )
        advance_button, pass_button = st.columns(2)
        if advance_button.button(
            "✅ Advance", type="primary", width="stretch", key=f"advance-{company.pk}"
        ):
            run_action(
                advance,
                company,
                person,
                comment=advance_comment,
                success=f"Advanced {company.name}.",
            )
        if pass_button.button("⛔ Pass…", width="stretch", key=f"pass-{company.pk}"):
            pass_dialog(company, person)

        st.markdown("**Messages**")
        intro = company.touchpoints.filter(channel="warm_intro").order_by("-received_at").first()
        if (
            intro
            and intro.intro_status == "open"
            and st.button("✉️ Reply to the founder", key=f"deal-reply-{company.pk}", width="stretch")
        ):
            intro_reply_dialog(intro, person)
        if intro and st.button(
            f"🙏 Thank {intro.introducer_name}", key=f"deal-thanks-{company.pk}", width="stretch"
        ):
            introducer_thanks_dialog(intro, person)
        sent = company.outbox_messages.count()
        st.caption(
            f"{sent} message{'s' if sent != 1 else ''} sent from the app (simulated)."
            if sent
            else "No messages sent yet."
        )


# ── Intro tracker ─────────────────────────────────────────────────────────────────


def intro_card(intro, state: dict, person: str) -> None:
    partner = responsible_partners().get(intro.recipient, intro.recipient)
    ownership = (
        f"owner {intro.recipient} (partner)"
        if partner == intro.recipient
        else f"owner {intro.recipient}, escalates to {partner}"
    )
    with st.container(border=True):
        heading, actions = st.columns([3, 2])
        heading.markdown(
            f"**{intro.company.name}** · {intro_urgency(intro, state)}  \n"
            f"From **{intro.introducer_name}** "
            f"({INTRODUCER_LABELS.get(intro.introducer_type, intro.introducer_type)}) · "
            f"received {long_date(intro.received_at)} · {ownership}"
        )
        reply, open_deal, more = actions.columns([2, 2, 1])
        if reply.button("✉️ Reply", key=f"reply-{intro.pk}", type="primary", width="stretch"):
            intro_reply_dialog(intro, person)
        open_deal.button(
            "Open deal",
            key=f"intro-deal-{intro.pk}",
            on_click=go_to,
            args=("Deal detail", intro.company_id),
            width="stretch",
        )
        with more.popover("⋯", help="More actions"):
            if st.button("Replied outside the app", key=f"replied-{intro.pk}"):
                run_action(
                    set_intro_status,
                    intro,
                    "replied",
                    person,
                    success=f"Intro for {intro.company.name} marked as replied.",
                )
            if st.button("Close without reply", key=f"closed-{intro.pk}"):
                run_action(
                    set_intro_status,
                    intro,
                    "closed",
                    person,
                    success=f"Intro for {intro.company.name} closed.",
                )


def intro_tracker(person: str) -> None:
    reply_days = load_triage_config()["intro_reply_working_days"]
    page_header(
        "Intro tracker",
        f"Warm intros get a reply within {reply_days} working days, whatever the fit. "
        "Day 2: reminder to the owner. Day 3: escalated to the responsible partner.",
    )
    states = intro_states()
    if not states:
        st.info(EMPTY_CRM)
        return
    waiting = sorted(
        ((intro, state) for intro, state in states if intro.intro_status == "open"),
        key=lambda pair: (not pair[1]["past_deadline"], pair[1]["deadline"]),
    )
    remember_deal_list(
        "Intros needing a reply", list(dict.fromkeys(intro.company_id for intro, _ in waiting))
    )
    needs_reply_tab, all_tab = st.tabs(
        [f"Needs a reply ({len(waiting)})", f"All intros ({len(states)})"]
    )
    with needs_reply_tab:
        if not waiting:
            st.success("✅ Every warm intro has had a reply.")
        for intro, state in waiting:
            intro_card(intro, state, person)
    with all_tab:
        rows = [
            {
                "Company": intro.company.name,
                "Introducer": intro.introducer_name,
                "Type": INTRODUCER_LABELS.get(intro.introducer_type, intro.introducer_type),
                "Received": intro.received_at,
                "Owner": intro.recipient,
                "Deadline": state["deadline"],
                "Status": intro_urgency(intro, state),
            }
            for intro, state in sorted(states, key=lambda pair: pair[0].received_at, reverse=True)
        ]
        st.dataframe(pd.DataFrame(rows), hide_index=True, width="stretch")


# ── Merge queue ───────────────────────────────────────────────────────────────────


def company_card(column, company) -> None:
    touchpoints = list(company.touchpoints.order_by("received_at"))
    with column.container(border=True):
        st.markdown(
            f"**{company.name}**  \n{company.website_domain or 'no website'} · {company.country}"
        )
        for touchpoint in touchpoints:
            identifiers = (
                " · ".join(
                    value
                    for value in (
                        touchpoint.website,
                        touchpoint.founder_email,
                        touchpoint.founder_linkedin,
                    )
                    if value
                )
                or "no website, email or LinkedIn"
            )
            st.caption(
                f"{long_date(touchpoint.received_at)} · {CHANNEL_LABELS[touchpoint.channel]} to "
                f"{touchpoint.recipient} as “{touchpoint.company_name}” · {identifiers}"
            )


def merge_queue(person: str) -> None:
    from Inputs.MergeSuggestion import MergeSuggestion

    page_header(
        "Merge queue",
        "These companies have very similar names and no conflicting website. Nothing is merged "
        "until a person decides.",
    )
    pending = list(
        MergeSuggestion.objects.filter(status="pending").select_related("company", "candidate")
    )
    if not pending:
        st.success("✅ No possible duplicates waiting.")
        return
    position = min(st.session_state.get("merge_position", 0), len(pending) - 1)
    suggestion = pending[position]
    st.progress((position + 1) / len(pending), text=f"Pair {position + 1} of {len(pending)}")
    st.markdown(
        f"Name similarity **{suggestion.similarity:.2f}** after removing legal suffixes and words "
        "like “AI” or “Labs”. Is this the same company?"
    )
    left, right = st.columns(2)
    company_card(left, suggestion.company)
    company_card(right, suggestion.candidate)
    same, different, skip, _ = st.columns([2, 2, 1, 3])
    if same.button("✅ Same company, merge", type="primary", width="stretch"):
        run_action(
            approve_merge, suggestion, person, success=f"Merged into {suggestion.company.name}."
        )
    if different.button("⛔ Different companies", width="stretch"):
        run_action(reject_merge, suggestion, person, success="Kept as two companies.")
    if skip.button("Skip", width="stretch"):
        st.session_state["merge_position"] = (position + 1) % len(pending)
        st.rerun()


# ── Audit log ─────────────────────────────────────────────────────────────────────


def audit_log(person: str) -> None:
    from Inputs.Decision import Decision

    page_header(
        "Audit log", "Every decision, rating, rank override and merge — each one a person's click."
    )
    decisions = pd.DataFrame(
        Decision.objects.order_by("-decided_at").values(
            "decided_at", "decided_by", "company_name", "decision", "pass_code", "comment"
        )
    )
    if decisions.empty:
        st.info("No decisions logged yet.")
        return
    by_person, by_type = st.columns(2)
    people = by_person.multiselect(
        "Who", sorted(decisions["decided_by"].unique()), placeholder="Everyone"
    )
    kinds = by_type.multiselect(
        "Decision", sorted(decisions["decision"].unique()), placeholder="All decisions"
    )
    if people:
        decisions = decisions[decisions["decided_by"].isin(people)]
    if kinds:
        decisions = decisions[decisions["decision"].isin(kinds)]
    decisions["pass_code"] = decisions["pass_code"].map(
        lambda code: PASS_CODE_LABELS.get(code, code)
    )
    st.dataframe(
        decisions.rename(
            columns={
                "decided_at": "When",
                "decided_by": "Who",
                "company_name": "Company",
                "decision": "Decision",
                "pass_code": "Pass reason",
                "comment": "Comment",
            }
        ),
        hide_index=True,
        width="stretch",
        column_config={"When": st.column_config.DatetimeColumn("When", format="D MMM YYYY, HH:mm")},
    )


# ── Outbox (simulated) ────────────────────────────────────────────────────────────

MESSAGE_KIND_LABELS = {
    "intro_reply": "✉️ Intro reply to founder",
    "pass": "⛔ Pass reply to founder",
    "introducer_thanks": "🙏 Thank-you to introducer",
}


def outbox(person: str) -> None:
    from Inputs.OutboxMessage import OutboxMessage

    page_header(
        "Outbox",
        "Every reply sent from the app. Sending is simulated: messages are stored here and in "
        "the audit log, and never delivered.",
    )
    messages = list(OutboxMessage.objects.order_by("-sent_at"))
    if not messages:
        st.info("Nothing sent yet. Reply to an intro in the Intro tracker, or pass on a deal.")
        return
    kinds = st.multiselect(
        "Type",
        list(MESSAGE_KIND_LABELS),
        format_func=MESSAGE_KIND_LABELS.get,
        placeholder="All types",
    )
    for message in messages:
        if kinds and message.kind not in kinds:
            continue
        label = (
            f"{MESSAGE_KIND_LABELS.get(message.kind, message.kind)} · {message.company_name} → "
            f"{message.recipient_name or '–'} · {message.sent_at:%d %b %H:%M} by {message.sent_by}"
        )
        with st.expander(label):
            address = message.recipient_address or "no address on file"
            st.caption(f"To: {address} · Subject: {message.subject}")
            st.text(message.body)
