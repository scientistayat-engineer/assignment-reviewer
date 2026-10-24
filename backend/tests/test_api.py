import os
import sys
from io import BytesIO
from pathlib import Path

os.environ["MOCK_LLM"] = "true"
os.environ["DB_PATH"] = str(Path(__file__).parent / "test.db")
os.environ["TEACHER_USERNAME"] = "teacher"
os.environ["TEACHER_PASSWORD"] = "teacher123"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from app.main import app

GOOD = ("Supervised learning uses labeled data to learn a mapping from inputs to known outputs, "
        "for example spam classification. Unsupervised learning finds patterns structure and clusters "
        "in unlabeled data, for example customer clustering segmentation.")


@pytest.fixture(scope="module")
def client():
    Path(os.environ["DB_PATH"]).unlink(missing_ok=True)
    with TestClient(app) as c:
        assert c.post("/api/auth/login", json={"username": "teacher", "password": "teacher123"}).status_code == 200
        yield c
    Path(os.environ["DB_PATH"]).unlink(missing_ok=True)


@pytest.fixture(scope="module")
def student(client):
    with TestClient(app) as s:
        r = s.post("/api/auth/register", json={"username": "sara", "display_name": "Sara Khan", "password": "secret12"})
        assert r.status_code == 201
        yield s


def test_auth_required_and_wrong_password():
    with TestClient(app) as anon:
        assert anon.get("/api/questions").status_code == 401
        assert anon.get("/api/health").status_code == 200
        bad = anon.post("/api/auth/login", json={"username": "teacher", "password": "nope"})
        assert bad.status_code == 401


def test_health_and_seed(client):
    assert client.get("/api/health").json()["mode"] == "demo"
    assert len(client.get("/api/questions").json()) >= 2


def test_review_flow_and_scores_in_range(client):
    r = client.post("/api/reviews", json={"question_id": 1, "student_name": "Ali", "answer": GOOD})
    assert r.status_code == 201
    d = r.json()
    assert 0 <= d["ai_score"] <= 10
    assert all(0 <= c["score"] <= c["max"] for c in d["criteria_scores"])


def test_routing_band():
    from app.graph.nodes import route
    for s, want in [(3, "finish"), (4, "teacher_review"), (5, "teacher_review"), (6, "teacher_review"), (7, "finish")]:
        assert route({"score": s}) == want


def test_teacher_override_and_pdf(client):
    r = client.post("/api/reviews", json={"question_id": 1, "answer": "Machine learning is cool stuff overall."}).json()
    res = client.post(f"/api/reviews/{r['id']}/decision", json={"action": "override", "final_score": 8, "note": "Good effort"})
    assert res.json()["final_score"] == 8 and res.json()["teacher_status"] == "overridden"
    pdf = client.get(f"/api/reviews/{r['id']}/pdf")
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"


def test_override_requires_score(client):
    assert client.post("/api/reviews/1/decision", json={"action": "override"}).status_code == 422


def test_custom_question_and_validation(client):
    ok = client.post("/api/questions", json={"title": "Bias", "text": "What is bias in ML?",
                     "criteria": [{"name": "Definition", "max_points": 5, "description": "systematic error"}]})
    assert ok.status_code == 201
    assert client.post("/api/questions", json={"title": "x", "text": "?", "criteria": []}).status_code == 422


def test_student_role_limits(client, student):
    mine = student.post("/api/reviews", json={"question_id": 1, "student_name": "Fake Name", "answer": GOOD}).json()
    assert mine["student_name"] == "Sara Khan"          # name comes from the account
    assert "similarity" not in mine and "run_id" not in mine
    assert student.get("/api/queue").status_code == 403
    assert student.get("/api/stats").status_code == 403
    assert student.post("/api/questions", json={"title": "abc", "text": "hello?", "criteria": [{"name": "a", "max_points": 1}]}).status_code == 403
    ids = {r["id"] for r in student.get("/api/reviews").json()}
    assert ids == {mine["id"]}                          # sees only own reviews
    assert student.get("/api/reviews/1").status_code == 404
    assert student.get(f"/api/reviews/{mine['id']}/pdf").status_code == 200


def test_similarity_detection(client):
    a = client.post("/api/reviews", json={"question_id": 2, "student_name": "A", "answer": "Overfitting is when a model memorizes training data and fails to generalize to new data, fixed by regularization."}).json()
    b = client.post("/api/reviews", json={"question_id": 2, "student_name": "B", "answer": "Overfitting is when a model memorizes training data and fails to generalize to new data, fixed by regularization."}).json()
    assert b["similarity"] >= 0.9 and b["similar_to"] == a["id"]
    pairs = client.get("/api/similarity?threshold=0.8").json()
    assert any({p["a"]["id"], p["b"]["id"]} == {a["id"], b["id"]} for p in pairs)


def test_reevaluate_keeps_previous_score(client):
    r = client.post("/api/reviews", json={"question_id": 1, "student_name": "Z", "answer": "Short vague answer about machine learning."}).json()
    again = client.post(f"/api/reviews/{r['id']}/reevaluate").json()
    assert again["prev_score"] == r["ai_score"] and again["final_score"] is None


def test_extract_txt_and_docx(client):
    t = client.post("/api/extract", files={"file": ("a.txt", b"hello answer text", "text/plain")})
    assert t.status_code == 200 and t.json()["text"] == "hello answer text"
    from docx import Document
    d = Document(); d.add_paragraph("Docx answer body"); buf = BytesIO(); d.save(buf)
    r = client.post("/api/extract", files={"file": ("a.docx", buf.getvalue(), "application/octet-stream")})
    assert r.status_code == 200 and "Docx answer body" in r.json()["text"]
    assert client.post("/api/extract", files={"file": ("a.exe", b"x", "application/octet-stream")}).status_code == 415


def test_stats_agreement_and_csv(client):
    s = client.get("/api/stats").json()
    assert s["total"] >= 5 and len(s["distribution"]) == 11
    assert s["agreement"]["decided"] >= 1 and s["agreement"]["overridden"] >= 1
    assert "id,date,student" in client.get("/api/export.csv").text
    assert client.get("/api/reviews?score=8").status_code == 200
