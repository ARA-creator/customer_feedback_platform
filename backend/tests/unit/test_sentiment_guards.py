from app.services.sentiment import analyze_sentiment
from app.services.sentiment_guards import (
    apply_threat_and_clash,
    detect_sarcasm_clash,
    emoji_polarity_delta,
    threat_hits,
)


def test_threat_hits_track_you_down():
    hits = threat_hits("Else I'll track you down and sell your house and kids")
    assert hits
    assert any("track" in h.lower() for h in hits)


def test_emoji_polarity_negative_devils():
    delta, counts = emoji_polarity_delta("hello 😈😈😈")
    assert counts["negative"] == 3
    assert delta < 0


def test_emoji_polarity_positive():
    delta, counts = emoji_polarity_delta("love it 😍🎉👍")
    assert counts["positive"] >= 3
    assert delta > 0


def test_sarcasm_clash_praise_plus_emoji():
    assert detect_sarcasm_clash("Great job 😈", threat=False, emoji_neg=1)


def test_apply_threat_forces_negative_despite_praise():
    out = apply_threat_and_clash(
        compound=0.6,
        label="positive",
        text="Great... Else I'll track you down and sell your house and kids😈😈😈",
    )
    assert out["threat"] is True
    assert out["label"] == "negative"
    assert out["compound"] <= -0.55


def test_analyze_joke_threat_is_negative():
    text = "Great... I'd be waiting... Else I'll track you down and sell your house and kids😈😈😈"
    r = analyze_sentiment(text, allow_llm=False)
    assert r["label"] == "negative"
    assert r["signals"]["threat"] is True
    assert r["needs_review"] is True


def test_analyze_sarcasm_claim_ruin():
    r = analyze_sentiment("Great job ruining my claim 😈", allow_llm=False)
    assert r["label"] in {"negative", "neutral"}
    assert r["label"] != "positive"
    assert r["signals"]["sarcasm_clash"] is True


def test_plain_thanks_still_positive():
    r = analyze_sentiment("Thank you for resolving my claim so quickly!", allow_llm=False)
    assert r["label"] == "positive"
