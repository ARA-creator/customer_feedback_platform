from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    Index,
    func,
)

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(Text, nullable=True)
    full_name = Column(String(160), nullable=True)
    role = Column(String(50), nullable=True)
    account_type = Column(String(20), nullable=True, index=True)  # enterprise | external
    auth_provider = Column(String(20), nullable=True)  # local | azure_ad
    provider_subject = Column(String(128), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    suspended_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    email_verification_nonce = Column(String(64), nullable=True)
    email_verification_code_hash = Column(String(128), nullable=True)
    email_verification_code_expires_at = Column(DateTime(timezone=True), nullable=True)
    password_reset_nonce = Column(String(64), nullable=True)
    password_reset_code_hash = Column(String(128), nullable=True)
    password_reset_code_expires_at = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(80), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(160), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    role_id = Column(Integer, nullable=False, index=True)

    # v1 scoping fields (optional). Keep simple until multi-tenant is added.
    team = Column(String(120), nullable=True, index=True)
    region = Column(String(120), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    role_id = Column(Integer, nullable=False, index=True)
    permission_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    actor_user_id = Column(Integer, nullable=True, index=True)
    action = Column(String(120), nullable=False, index=True)
    target_type = Column(String(80), nullable=True, index=True)
    target_id = Column(String(120), nullable=True, index=True)
    meta = Column(Text, nullable=True)  # JSON
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ReportSchedule(Base):
    __tablename__ = "report_schedules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String(120), nullable=False, default="Scheduled report")
    cadence = Column(String(20), nullable=False, default="weekly")  # daily|weekly|monthly
    time_of_day = Column(String(8), nullable=True)  # "08:00"
    timezone = Column(String(40), nullable=True, default="UTC")
    recipients = Column(Text, nullable=True)  # JSON list of emails
    filters = Column(Text, nullable=True)  # JSON object of filters
    format = Column(String(10), nullable=False, default="csv")  # csv|pdf
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AppSetting(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(160), nullable=False, unique=True, index=True)
    value = Column(Text, nullable=True)  # JSON string
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    type = Column(String(80), nullable=False, index=True)  # e.g. new_feedback, assigned_to_me, admin_user_event
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    href = Column(String(255), nullable=True)  # optional deep link (frontend interprets)
    meta = Column(Text, nullable=True)  # JSON
    read_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, unique=True, index=True)
    prefs = Column(Text, nullable=True)  # JSON
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AnomalyDedupe(Base):
    """Cooldown tracking so the same anomaly scope does not notify repeatedly."""

    __tablename__ = "anomaly_dedupe"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dedupe_key = Column(String(64), unique=True, nullable=False, index=True)
    last_fired_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )


class Feedback(Base):
    """Core feedback entity representing a single customer feedback item.

    Notes:
        - Free-text fields that may contain PII are stored encrypted (app-level).
        - Email is stored as a one-way hash + encrypted copy to reduce exposure.
        - Soft deletes are supported via deleted_at for DPA compliance.
    """

    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Origin of the feedback (api, web_form, csv_import, whatsapp, email, etc.)
    source = Column(String(50), nullable=False, default="api")

    # Optional internal reference (e.g., insurer policy number)
    customer_id = Column(String(64), nullable=True)

    # Email is never stored in plaintext:
    email_hash = Column(String(128), nullable=True, index=True)
    email_encrypted = Column(Text, nullable=True)

    # Free-text message encrypted; decryption performed in the application layer.
    message_encrypted = Column(Text, nullable=False)

    # Optional 1-5 rating; can be null if only text is provided.
    rating = Column(Integer, nullable=True)

    # High-level category, useful for dashboard filters and routing.
    category = Column(String(50), nullable=True, index=True)

    # When the feedback was created on the server (ideally UTC).
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Sentiment analysis results (e.g., from VADER or transformers).
    sentiment_label = Column(String(20), nullable=True, index=True)
    sentiment_score = Column(Float, nullable=True)

    # Precomputed priority score for queueing follow-up actions.
    priority = Column(Integer, nullable=True, index=True)

    # JSON-encoded list of tags (e.g., ["claims", "refund"]).
    tags = Column(Text, nullable=True)

    # Consent flags, important for Ghana DPA and other data protection regimes.
    consent_given = Column(Boolean, nullable=False, default=False)
    consent_text = Column(Text, nullable=True)

    # Channel-specific metadata encoded as JSON (e.g., masked phone, campaign).
    channel_metadata = Column(Text, nullable=True)

    # Mark records as logically deleted without hard-deleting from the DB.
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    def soft_delete(self) -> None:
        """Mark the feedback as deleted without removing the row."""
        self.deleted_at = datetime.now(tz=timezone.utc)


# Additional useful indexes for performance on dashboards and analytics
Index("ix_feedback_created_at", Feedback.created_at)
Index("ix_feedback_priority_created", Feedback.priority, Feedback.created_at)


class FeedbackSearchDocument(Base):
    __tablename__ = "feedback_search_documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    feedback_id = Column(Integer, nullable=False, unique=True, index=True)
    source = Column(String(50), nullable=True, index=True)
    category = Column(String(50), nullable=True, index=True)
    customer_key = Column(String(255), nullable=True, index=True)
    customer_label = Column(String(255), nullable=True)
    campaign = Column(String(120), nullable=True, index=True)
    location = Column(String(120), nullable=True, index=True)
    language = Column(String(50), nullable=True, index=True)
    customer_tier = Column(String(50), nullable=True, index=True)
    tags_text = Column(Text, nullable=True)
    message_search_text = Column(Text, nullable=False)
    metadata_search_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CustomerProfile(Base):
    __tablename__ = "customer_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    external_customer_id = Column(String(64), nullable=True, unique=True, index=True)
    display_name = Column(String(255), nullable=True)
    primary_email_hash = Column(String(128), nullable=True, index=True)
    primary_email_encrypted = Column(Text, nullable=True)
    customer_tier = Column(String(50), nullable=True, index=True)
    lifecycle_stage = Column(String(50), nullable=True)
    company = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CustomerIdentifier(Base):
    __tablename__ = "customer_identifiers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_profile_id = Column(Integer, nullable=False, index=True)
    identifier_type = Column(String(50), nullable=False, index=True)
    identifier_value = Column(String(255), nullable=False, index=True)
    label = Column(String(255), nullable=True)
    source = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CustomerPurchase(Base):
    __tablename__ = "customer_purchases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_profile_id = Column(Integer, nullable=False, index=True)
    purchase_ref = Column(String(120), nullable=True, index=True)
    product_name = Column(String(255), nullable=False)
    product_line = Column(String(120), nullable=True, index=True)
    amount = Column(Float, nullable=True)
    currency = Column(String(16), nullable=True, default="GHS")
    status = Column(String(50), nullable=True, default="active")
    purchased_at = Column(DateTime(timezone=True), nullable=True)
    renewal_at = Column(DateTime(timezone=True), nullable=True)
    purchase_metadata = Column("metadata", Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CustomerSupportTicket(Base):
    __tablename__ = "customer_support_tickets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_profile_id = Column(Integer, nullable=False, index=True)
    ticket_ref = Column(String(120), nullable=True, index=True)
    subject = Column(String(255), nullable=False)
    status = Column(String(50), nullable=True, default="open")
    priority = Column(String(50), nullable=True, default="medium")
    opened_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    channel = Column(String(50), nullable=True)
    summary = Column(Text, nullable=True)
    ticket_metadata = Column("metadata", Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CustomerDemographics(Base):
    __tablename__ = "customer_demographics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_profile_id = Column(Integer, nullable=False, unique=True, index=True)
    age_range = Column(String(50), nullable=True)
    gender = Column(String(50), nullable=True)
    location = Column(String(120), nullable=True, index=True)
    language = Column(String(50), nullable=True, index=True)
    segment = Column(String(120), nullable=True, index=True)
    occupation = Column(String(120), nullable=True)
    demographics_metadata = Column("metadata", Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class FeedbackWorkflow(Base):
    __tablename__ = "feedback_workflows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    feedback_id = Column(Integer, nullable=False, unique=True, index=True)
    assigned_team = Column(String(120), nullable=True, index=True)
    assigned_user_id = Column(Integer, nullable=True, index=True)
    status = Column(String(50), nullable=False, default="Open", index=True)
    approval_required = Column(Boolean, nullable=False, default=False)
    approval_status = Column(String(50), nullable=False, default="not_requested", index=True)
    sla_due_at = Column(DateTime(timezone=True), nullable=True, index=True)
    escalated_at = Column(DateTime(timezone=True), nullable=True)
    escalation_level = Column(Integer, nullable=False, default=0)
    last_follow_up_at = Column(DateTime(timezone=True), nullable=True)
    last_seen_by_customer_at = Column(DateTime(timezone=True), nullable=True)
    customer_seen_status = Column(String(50), nullable=False, default="unknown")
    subsequent_sentiment = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class FeedbackReplyDraft(Base):
    __tablename__ = "feedback_reply_drafts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    feedback_id = Column(Integer, nullable=False, index=True)
    created_by_user_id = Column(Integer, nullable=True, index=True)
    approved_by_user_id = Column(Integer, nullable=True, index=True)
    channel = Column(String(50), nullable=False, default="internal")
    visibility = Column(String(50), nullable=False, default="private")  # private|public|dm|email
    tone = Column(String(50), nullable=True)
    brand_guidelines = Column(Text, nullable=True)
    ab_variant = Column(String(10), nullable=True)
    body = Column(Text, nullable=False)
    alt_body = Column(Text, nullable=True)
    ai_generated = Column(Boolean, nullable=False, default=False)
    model_name = Column(String(120), nullable=True)
    approval_status = Column(String(50), nullable=False, default="pending")
    approval_note = Column(Text, nullable=True)
    approval_assigned_to_user_id = Column(Integer, nullable=True, index=True)
    send_status = Column(String(50), nullable=False, default="draft")  # draft|queued_internal|sent|failed
    send_error = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    seen_at = Column(DateTime(timezone=True), nullable=True)
    seen_status = Column(String(50), nullable=False, default="unknown")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class FeedbackNote(Base):
    __tablename__ = "feedback_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    feedback_id = Column(Integer, nullable=False, index=True)
    author_user_id = Column(Integer, nullable=True, index=True)
    parent_note_id = Column(Integer, nullable=True, index=True)
    note_type = Column(String(50), nullable=False, default="internal")
    body = Column(Text, nullable=False)
    mentions = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class FeedbackSurvey(Base):
    __tablename__ = "feedback_surveys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    feedback_id = Column(Integer, nullable=False, index=True)
    reply_draft_id = Column(Integer, nullable=True, index=True)
    survey_type = Column(String(50), nullable=False, default="micro")
    sent_at = Column(DateTime(timezone=True), nullable=True)
    response_score = Column(Integer, nullable=True)
    response_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class FeedbackPolicyMatch(Base):
    """
    Privacy-safe policy number matches extracted from feedback plaintext.

    We store only:
      - salted hash for linking/deduplication
      - masked policy string for display
      - product prefix + group/description from the known mapping table
    """

    __tablename__ = "feedback_policy_matches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    feedback_id = Column(Integer, nullable=False, index=True)

    policy_hash = Column(String(64), nullable=False, index=True)
    policy_masked = Column(String(32), nullable=False)

    product_prefix = Column(String(4), nullable=False, index=True)
    product_group = Column(String(120), nullable=True, index=True)
    product_description = Column(String(255), nullable=True)

    confidence = Column(Float, nullable=False, default=0.0)
    is_primary = Column(Boolean, nullable=False, default=False, index=True)
    needs_review = Column(Boolean, nullable=False, default=False, index=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ReleaseEvent(Base):
    """
    Product release/launch event used for 'release impact' before/after analytics.

    product_prefixes is stored as JSON text array (e.g. ["GH3V","BB1V"]).
    """

    __tablename__ = "release_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    released_at = Column(DateTime(timezone=True), nullable=False, index=True)
    product_prefixes = Column(Text, nullable=True)  # JSON list
    notes = Column(Text, nullable=True)
    links = Column(Text, nullable=True)  # JSON list or free text

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ExternalIngestedItem(Base):
    """
    Tracks external items we've already ingested (e.g., RSS/web mentions).

    Purpose: dedupe repeated polling runs when the external source doesn't provide
    stable unique IDs that we store elsewhere.
    """

    __tablename__ = "external_ingested_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source = Column(String(50), nullable=False, default="web")
    url = Column(Text, nullable=False)
    url_hash = Column(String(64), nullable=False, unique=True, index=True)
    first_seen_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )