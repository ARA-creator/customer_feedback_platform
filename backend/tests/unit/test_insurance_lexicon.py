"""Insurance lexicon matching + sentiment polarity nudges."""

from app.services.insurance_lexicon import (
    lexicon_entry_count,
    lexicon_sentiment_delta,
    match_lexicon,
)
from app.services.insurance_tags import categorize_insurance_tags
from app.services.sentiment import analyze_sentiment


def test_lexicon_loaded_at_least_1230_entries():
    assert lexicon_entry_count() >= 1230


def test_lexicon_matches_premium_and_claim():
    hits = match_lexicon("My premium is overdue and the claim was delayed.")
    norms = {h.normalized for h in hits}
    assert "premium" in norms or any("premium" in n for n in norms)
    assert "claim" in norms or any("claim" in n for n in norms)


def test_repudiation_pushes_negative_sentiment():
    r = analyze_sentiment(
        "They issued a repudiation of my claim after months of delay.",
        source="email",
        insurance_tags=["claims"],
    )
    assert r["label"] == "negative"
    assert r["score"] < -0.15


def test_lexicon_enriches_theme_tags():
    tags = categorize_insurance_tags("Please process the reinstatement of my lapsed policy.")
    assert "policy" in tags or "premiums" in tags


def test_lexicon_sentiment_delta_negative_for_lapse():
    delta = lexicon_sentiment_delta("My policy lapsed because of arrears.")
    assert delta < 0
