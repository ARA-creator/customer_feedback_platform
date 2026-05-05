"""Sentiment: VADER lexicon + insurance-tag/channel gating."""

from app.services.sentiment import analyze_sentiment


def test_benefit_terrible_negative_with_benefits_tag_and_channel():
    r = analyze_sentiment("Benefit was terrible.", source="api", insurance_tags=["benefits"])
    assert r["label"] == "negative"
    assert r["score"] < -0.2


def test_benefit_terrible_negative_channel_only_web():
    r = analyze_sentiment("Benefit was terrible.", source="web", insurance_tags=None)
    assert r["label"] == "negative"


def test_benefit_terrible_not_gated_unknown_source_no_tags():
    r = analyze_sentiment("Benefit was terrible.", source="internal_note", insurance_tags=None)
    assert r["label"] in ("neutral", "negative")


def test_strongly_positive_unchanged_with_tags():
    r = analyze_sentiment(
        "The benefits team was outstanding and resolved everything perfectly.",
        source="web",
        insurance_tags=["benefits"],
    )
    assert r["label"] == "positive"
