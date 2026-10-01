"""OutboxMessage — a reply "sent" from the app. Simulated: nothing ever leaves the app.

Replies to founders (intro acknowledgements, passes) and thank-you notes to introducers
are drafted from one template library and sent with a person's click. Sending writes
the message here and a Decision row; no email is delivered anywhere.
"""

from django.db import models
from django.utils import timezone
from lex.core.models.LexModel import LexModel

from Inputs.Company import Company


class OutboxMessage(LexModel):
    id = models.AutoField(primary_key=True)
    # Kept when the company row is rebuilt or merged away, like the Decision log.
    company = models.ForeignKey(
        Company, on_delete=models.SET_NULL, null=True, blank=True, related_name="outbox_messages"
    )
    company_name = models.CharField(max_length=255)
    # intro_reply / pass / introducer_thanks
    kind = models.CharField(max_length=30)
    recipient_name = models.CharField(max_length=255, blank=True, default="")
    recipient_address = models.CharField(max_length=255, blank=True, default="")
    subject = models.CharField(max_length=255)
    body = models.TextField()
    sent_by = models.CharField(max_length=255)
    sent_at = models.DateTimeField(default=timezone.now)

    def __str__(self) -> str:
        return f"{self.kind} · {self.company_name} → {self.recipient_name}"
