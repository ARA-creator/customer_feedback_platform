from app.integrations.meta_integration import parse_facebook_comment, parse_facebook_webhook


def test_parse_facebook_feed_comment():
    payload = {
        "object": "page",
        "entry": [
            {
                "id": "61590802647891",
                "changes": [
                    {
                        "field": "feed",
                        "value": {
                            "item": "comment",
                            "verb": "add",
                            "comment_id": "987654",
                            "post_id": "111_222",
                            "message": "Hello from a customer comment",
                            "from": {"id": "12345", "name": "Test User"},
                        },
                    }
                ],
            }
        ],
    }
    result = parse_facebook_webhook(payload)
    assert result is not None
    assert result["message"] == "Hello from a customer comment"
    assert result["source"] == "facebook"
    assert result["channel_metadata"]["type"] == "comment"
    assert result["channel_metadata"]["comment_id"] == "987654"


def test_parse_facebook_comment_skips_page_self_comment():
    entry = {"id": "61590802647891"}
    change = {
        "field": "feed",
        "value": {
            "item": "comment",
            "verb": "add",
            "comment_id": "1",
            "message": "Comment as page",
            "from": {"id": "61590802647891", "name": "FreskNkus"},
        },
    }
    assert parse_facebook_comment(entry, change, {"object": "page"}) is None


def test_parse_facebook_comment_skips_removed():
    entry = {"id": "page1"}
    change = {
        "field": "feed",
        "value": {
            "item": "comment",
            "verb": "remove",
            "message": "deleted",
            "from": {"id": "user1", "name": "User"},
        },
    }
    assert parse_facebook_comment(entry, change, {"object": "page"}) is None
