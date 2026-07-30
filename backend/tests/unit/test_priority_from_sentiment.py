from app.services.prioritization import HIGH_PRIORITY_SENTIMENT_SCORE, priority_from_sentiment


def test_priority_high_only_when_score_at_or_below_threshold():
    assert HIGH_PRIORITY_SENTIMENT_SCORE == -0.7
    assert priority_from_sentiment(sentiment_label="negative", sentiment_score=-0.7) == 100
    assert priority_from_sentiment(sentiment_label="negative", sentiment_score=-0.9) == 100
    assert priority_from_sentiment(sentiment_label="negative", sentiment_score=-1.0) == 100


def test_priority_medium_for_mild_negative():
    assert priority_from_sentiment(sentiment_label="negative", sentiment_score=-0.699) == 50
    assert priority_from_sentiment(sentiment_label="negative", sentiment_score=-0.5) == 50
    assert priority_from_sentiment(sentiment_label="negative", sentiment_score=-0.2) == 50


def test_priority_neutral_and_positive():
    assert priority_from_sentiment(sentiment_label="neutral", sentiment_score=0.0) == 50
    assert priority_from_sentiment(sentiment_label="positive", sentiment_score=0.8) == 10


def test_priority_falls_back_to_label_when_score_missing():
    assert priority_from_sentiment(sentiment_label="negative", sentiment_score=None) == 50
    assert priority_from_sentiment(sentiment_label="positive", sentiment_score=None) == 10
