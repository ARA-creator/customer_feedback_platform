import json


def test_create_feedback_requires_message(client):
    res = client.post(
        "/api/feedback",
        data=json.dumps({}),
        content_type="application/json",
    )
    assert res.status_code == 400
    data = res.get_json()
    assert "error" in data


def test_create_feedback_minimal(client):
    res = client.post(
        "/api/feedback",
        data=json.dumps({"message": "Great service today, thank you."}),
        content_type="application/json",
    )
    assert res.status_code == 201
    data = res.get_json()
    assert data.get("message") == "Feedback created successfully"
    fb = data.get("feedback")
    assert fb is not None
    assert "id" in fb
    assert fb["source"] == "api"
    assert "sentiment_label" in fb
    assert "sentiment_score" in fb


def test_create_feedback_web_form_with_rating_and_category(client):
    res = client.post(
        "/api/feedback",
        data=json.dumps(
            {
                "message": "Claim took too long to process.",
                "source": "web",
                "rating": 2,
                "category": "claims",
                "tags": ["urgent", "delay"],
            }
        ),
        content_type="application/json",
    )
    assert res.status_code == 201
    data = res.get_json()
    fb = data["feedback"]
    assert fb["source"] == "web"
    assert fb["rating"] == 2
    assert fb["category"] == "claims"
    assert fb["tags"] is not None


def test_feed_scoped_to_assigned_user(client):
    from app.database import SessionLocal
    from app.models import FeedbackWorkflow

    # Create two users: agentA and agentB
    res_a = client.post(
        "/api/auth/signup",
        json={"email": "agentA_scope@example.com", "password": "very-strong-passwordA", "role": "agent"},
    )
    assert res_a.status_code == 201
    agent_a_id = res_a.get_json()["user"]["id"]

    # Create a feedback item while logged in as agentA
    created = client.post(
        "/api/feedback",
        json={"message": "Item that should be assigned to B", "source": "web"},
    )
    assert created.status_code == 201
    feedback_id = created.get_json()["feedback"]["id"]

    # Create agentB in a separate client session
    client_b = client.application.test_client()
    res_b = client_b.post(
        "/api/auth/signup",
        json={"email": "agentB_scope@example.com", "password": "very-strong-passwordB", "role": "agent"},
    )
    assert res_b.status_code == 201
    agent_b_id = res_b.get_json()["user"]["id"]
    assert agent_b_id != agent_a_id

    # Workflow HTTP endpoints are removed; assign directly for RBAC feed scoping tests.
    db = SessionLocal()
    try:
        wf = db.query(FeedbackWorkflow).filter(FeedbackWorkflow.feedback_id == feedback_id).first()
        assert wf is not None
        wf.assigned_user_id = agent_b_id
        db.commit()
    finally:
        db.close()

    # AgentA feed should NOT include the item
    feed_a = client.get("/api/feedback/feed?limit=50")
    assert feed_a.status_code == 200
    ids_a = [item["id"] for item in feed_a.get_json()["items"]]
    assert feedback_id not in ids_a

    # AgentB feed SHOULD include the item
    feed_b = client_b.get("/api/feedback/feed?limit=50")
    assert feed_b.status_code == 200
    ids_b = [item["id"] for item in feed_b.get_json()["items"]]
    assert feedback_id in ids_b


def test_admin_reprocess_insurance_tags_keyset_oldest(client):
    from app.database import SessionLocal
    from app.models import Feedback

    su = client.post(
        "/api/auth/signup",
        json={
            "email": "insurance_reprocess_su@example.com",
            "password": "very-strong-passwordSU",
            "role": "super_admin",
        },
    )
    assert su.status_code == 201

    for msg in ("A claim delay", "Premium is too high", "App login error"):
        cr = client.post("/api/feedback", json={"message": msg, "source": "api"})
        assert cr.status_code == 201

    db = SessionLocal()
    try:
        n_feedback = db.query(Feedback).filter(Feedback.deleted_at.is_(None)).count()
    finally:
        db.close()
    assert n_feedback == 3, n_feedback

    total_updated = 0
    next_cursor = None
    for _ in range(10):
        qs = "order=oldest&limit=1&force=true"
        if next_cursor:
            cid = next_cursor["cursor_id"]
            qs += f"&cursor_id={cid}"
        res = client.post(f"/api/admin/reprocess-insurance-tags?{qs}")
        assert res.status_code == 200, res.get_json()
        body = res.get_json()
        assert body.get("ok") is True
        assert body.get("order") == "oldest"
        total_updated += int(body.get("updated") or 0)
        if body.get("done"):
            assert body.get("next_cursor") is None
            break
        assert body.get("next_cursor") is not None
        next_cursor = body["next_cursor"]
    else:
        raise AssertionError("reprocess loop did not finish")

    assert total_updated == 3

    feed = client.get("/api/feedback/feed?limit=50")
    assert feed.status_code == 200
    tagged = [it for it in feed.get_json().get("items", []) if isinstance(it.get("insurance_tags"), list) and it["insurance_tags"]]
    assert len(tagged) >= 3


def test_admin_reprocess_insurance_tags_invalid_cursor_id(client):
    su = client.post(
        "/api/auth/signup",
        json={
            "email": "insurance_reprocess_su2@example.com",
            "password": "very-strong-passwordSU2",
            "role": "super_admin",
        },
    )
    assert su.status_code == 201
    res = client.post("/api/admin/reprocess-insurance-tags?order=oldest&limit=1&cursor_id=notanint")
    assert res.status_code == 400
    assert "cursor_id" in (res.get_json() or {}).get("error", "").lower()
