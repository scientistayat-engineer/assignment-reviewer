"""REST API (role-aware: teacher and student)."""
import csv
import io
import json
import sqlite3
import uuid
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import Response as RawResponse

from .. import db
from ..config import settings
from ..graph.builder import graph
from ..schemas import LoginIn, QuestionIn, RegisterIn, ReviewRequest, TeacherDecision
from ..services import auth, tracing
from ..services.extract import extract_text
from ..services.pdf import review_pdf
from ..services.similarity import most_similar, similarity

router = APIRouter(prefix="/api")
SIM_FLAG = 0.6  # similarity at or above this is highlighted for the teacher


# ------------------------------------------------------------------- helpers
def _question(qid: int) -> dict:
    with db.conn() as c:
        r = c.execute("SELECT * FROM questions WHERE id=?", (qid,)).fetchone()
    if not r:
        raise HTTPException(404, "Question not found")
    return db.q_row(r)


def _review(rid: int, user: dict | None = None) -> dict:
    with db.conn() as c:
        r = c.execute("SELECT * FROM reviews WHERE id=?", (rid,)).fetchone()
    if not r or (user and user["role"] == "student" and r["user_id"] != user["id"]):
        raise HTTPException(404, "Review not found")
    return db.r_row(r)


def _view(review: dict, user: dict) -> dict:
    """Students must not see integrity data or trace ids."""
    if user["role"] == "teacher":
        return review
    return {k: v for k, v in review.items() if k not in {"similarity", "similar_to", "run_id", "user_id", "prev_score"}}


def _run_graph(q: dict, answer: str, student: str):
    run_id = str(uuid.uuid4())
    try:
        result = graph.invoke(
            {"question": q, "answer": answer},
            config={"run_name": "Assignment review", "run_id": run_id,
                    "tags": ["assignment-reviewer", f"question-{q['id']}"],
                    "metadata": {"student": student, "question_title": q["title"],
                                 "mode": "demo" if settings.mock_mode else "groq"}})
    except Exception as exc:
        raise HTTPException(502, f"Review failed: {exc}") from exc
    return result, (run_id if settings.tracing_active else None)


# ---------------------------------------------------------------------- auth
def _set_cookie(resp: Response, uid: int):
    resp.set_cookie(auth.COOKIE, auth.make_token(uid), httponly=True, samesite="lax",
                    max_age=settings.session_hours * 3600)


@router.post("/auth/login")
def login(body: LoginIn, response: Response):
    u = body.username.strip().lower()
    if auth.throttled(u):
        raise HTTPException(429, "Too many attempts. Try again in a minute.")
    with db.conn() as c:
        r = c.execute("SELECT * FROM users WHERE lower(username)=?", (u,)).fetchone()
    if not r or not auth.verify_password(body.password, r["password_hash"]):
        auth.record_fail(u)
        raise HTTPException(401, "Wrong username or password")
    _set_cookie(response, r["id"])
    return {"id": r["id"], "username": r["username"], "display_name": r["display_name"], "role": r["role"]}


@router.post("/auth/register", status_code=201)
def register(body: RegisterIn, response: Response):
    try:
        with db.conn() as c:
            cur = c.execute("INSERT INTO users(username,display_name,role,password_hash) VALUES(?,?,?,?)",
                            (body.username, body.display_name.strip(), "student", auth.hash_password(body.password)))
            uid = cur.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(409, "That username is taken")
    _set_cookie(response, uid)
    return {"id": uid, "username": body.username, "display_name": body.display_name.strip(), "role": "student"}


@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(auth.COOKIE)
    return {"ok": True}


@router.get("/auth/me")
def me(user: dict = Depends(auth.current_user)):
    return user


# -------------------------------------------------------------------- public
@router.get("/health")
def health():
    return {"status": "ok", "mode": "demo" if settings.mock_mode else "groq",
            "model": settings.groq_model, "tracing": settings.tracing_active,
            "langsmith_project": settings.langsmith_project,
            "review_band": [settings.review_min, settings.review_max]}


@router.get("/workflow")
def workflow(_: dict = Depends(auth.current_user)):
    return {"nodes": [
        {"id": "evaluate", "label": "Evaluate", "desc": "LangChain prompt + Groq model returns rubric scores"},
        {"id": "route", "label": "Route", "desc": f"Score {settings.review_min}-{settings.review_max} goes to teacher review"},
        {"id": "teacher_review", "label": "Teacher review", "desc": "Flags the submission for the teacher queue"},
        {"id": "finish", "label": "Finish", "desc": "Feedback is ready for the student"}]}


# ----------------------------------------------------------------- questions
@router.get("/questions")
def list_questions(_: dict = Depends(auth.current_user)):
    with db.conn() as c:
        return [db.q_row(r) for r in c.execute("SELECT * FROM questions ORDER BY id")]


@router.post("/questions", status_code=201)
def add_question(q: QuestionIn, _: dict = Depends(auth.teacher_only)):
    with db.conn() as c:
        cur = c.execute("INSERT INTO questions(title,text,criteria) VALUES(?,?,?)",
                        (q.title, q.text, json.dumps([x.model_dump() for x in q.criteria])))
        qid = cur.lastrowid
    return _question(qid)


@router.delete("/questions/{qid}")
def delete_question(qid: int, _: dict = Depends(auth.teacher_only)):
    _question(qid)
    with db.conn() as c:
        if c.execute("SELECT COUNT(*) FROM reviews WHERE question_id=?", (qid,)).fetchone()[0]:
            raise HTTPException(409, "Question already has reviews and cannot be deleted")
        c.execute("DELETE FROM questions WHERE id=?", (qid,))
    return {"deleted": qid}


# ------------------------------------------------------------------- uploads
@router.post("/extract")
async def extract(file: UploadFile, _: dict = Depends(auth.current_user)):
    data = await file.read()
    try:
        text = extract_text(file.filename or "", data)
    except ValueError as e:
        raise HTTPException(415, str(e))
    except Exception:
        raise HTTPException(422, "Could not read that file")
    if not text:
        raise HTTPException(422, "No text found in the file")
    return {"filename": file.filename, "text": text[:6000], "chars": len(text), "truncated": len(text) > 6000}


# ------------------------------------------------------------------- reviews
@router.post("/reviews", status_code=201)
def create_review(req: ReviewRequest, user: dict = Depends(auth.current_user)):
    q = _question(req.question_id)
    name = user["display_name"] if user["role"] == "student" else (req.student_name or "Anonymous")
    result, run_id = _run_graph(q, req.answer, name)
    with db.conn() as c:
        others = [dict(r) for r in c.execute(
            "SELECT id, answer FROM reviews WHERE question_id=?", (q["id"],))]
        sim, sim_id = most_similar(req.answer, others)
        cur = c.execute(
            """INSERT INTO reviews(question_id,student_name,answer,criteria_scores,ai_score,
               feedback,improvement,status,needs_teacher,teacher_status,mode,run_id,
               user_id,similarity,similar_to)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (q["id"], name, req.answer, json.dumps(result["criteria_scores"]), result["score"],
             result["feedback"], result["improvement"], result["status"], int(result["needs_teacher"]),
             "pending" if result["needs_teacher"] else "none", result["mode"], run_id,
             user["id"] if user["role"] == "student" else None, sim, sim_id))
        rid = cur.lastrowid
    return _view(_review(rid), user)


@router.get("/reviews")
def list_reviews(user: dict = Depends(auth.current_user), q: str = "", status: str = "",
                 question_id: int | None = None, score: int | None = Query(None, ge=0, le=10),
                 limit: int = Query(200, le=500)):
    sql, args = "SELECT * FROM reviews WHERE 1=1", []
    if user["role"] == "student":
        sql += " AND user_id=?"
        args.append(user["id"])
    if q:
        sql += " AND (student_name LIKE ? OR answer LIKE ?)"
        args += [f"%{q}%"] * 2
    if status == "flagged":
        sql += " AND needs_teacher=1"
    elif status == "ready":
        sql += " AND needs_teacher=0"
    elif status == "similar":
        sql += " AND similarity>=?"
        args.append(SIM_FLAG)
    elif status in {"pending", "approved", "overridden"}:
        sql += " AND teacher_status=?"
        args.append(status)
    if question_id:
        sql += " AND question_id=?"
        args.append(question_id)
    if score is not None:
        sql += " AND COALESCE(final_score, ai_score)=?"
        args.append(score)
    sql += " ORDER BY id DESC LIMIT ?"
    args.append(limit)
    with db.conn() as c:
        return [_view(db.r_row(r), user) for r in c.execute(sql, args)]


@router.get("/reviews/{rid}")
def get_review(rid: int, user: dict = Depends(auth.current_user)):
    return _view(_review(rid, user), user)


@router.delete("/reviews/{rid}")
def delete_review(rid: int, _: dict = Depends(auth.teacher_only)):
    _review(rid)
    with db.conn() as c:
        c.execute("DELETE FROM reviews WHERE id=?", (rid,))
    return {"deleted": rid}


@router.post("/reviews/{rid}/decision")
def decide(rid: int, d: TeacherDecision, _: dict = Depends(auth.teacher_only)):
    r = _review(rid)
    if d.action == "override" and d.final_score is None:
        raise HTTPException(422, "final_score is required to override")
    final = r["ai_score"] if d.action == "approve" else d.final_score
    with db.conn() as c:
        c.execute("UPDATE reviews SET final_score=?, teacher_status=?, teacher_note=? WHERE id=?",
                  (final, "approved" if d.action == "approve" else "overridden", d.note, rid))
    tracing.send_feedback(r.get("run_id"), "teacher_final_score", final / 10, d.note)
    return _review(rid)


@router.post("/reviews/{rid}/reevaluate")
def reevaluate(rid: int, _: dict = Depends(auth.teacher_only)):
    r = _review(rid)
    q = _question(r["question_id"])
    result, run_id = _run_graph(q, r["answer"], r["student_name"])
    with db.conn() as c:
        c.execute("""UPDATE reviews SET criteria_scores=?, prev_score=?, ai_score=?, feedback=?, improvement=?,
                     status=?, needs_teacher=?, teacher_status=?, final_score=NULL, teacher_note='',
                     mode=?, run_id=? WHERE id=?""",
                  (json.dumps(result["criteria_scores"]), r["ai_score"], result["score"], result["feedback"],
                   result["improvement"], result["status"], int(result["needs_teacher"]),
                   "pending" if result["needs_teacher"] else "none", result["mode"], run_id, rid))
    return _review(rid)


@router.get("/reviews/{rid}/pdf")
def review_as_pdf(rid: int, user: dict = Depends(auth.current_user)):
    r = _review(rid, user)
    data = review_pdf(r, _question(r["question_id"]))
    return RawResponse(data, media_type="application/pdf",
                       headers={"Content-Disposition": f'attachment; filename="review-{rid}.pdf"'})


@router.get("/queue")
def queue(_: dict = Depends(auth.teacher_only)):
    with db.conn() as c:
        return [db.r_row(r) for r in c.execute(
            "SELECT * FROM reviews WHERE teacher_status='pending' ORDER BY id")]


# ------------------------------------------------------------------ integrity
@router.get("/similarity")
def similarity_pairs(threshold: float = Query(0.5, ge=0.2, le=1.0), _: dict = Depends(auth.teacher_only)):
    with db.conn() as c:
        rows = [dict(r) for r in c.execute(
            "SELECT id, question_id, student_name, answer FROM reviews ORDER BY id DESC LIMIT 400")]
    by_q: dict[int, list] = {}
    for r in rows:
        by_q.setdefault(r["question_id"], []).append(r)
    pairs = []
    for qid, items in by_q.items():
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = items[i], items[j]
                s = similarity(a["answer"], b["answer"])
                if s >= threshold:
                    pairs.append({"question_id": qid, "similarity": round(s, 3),
                                  "a": {"id": a["id"], "student": a["student_name"], "answer": a["answer"][:700]},
                                  "b": {"id": b["id"], "student": b["student_name"], "answer": b["answer"][:700]},
                                  "same_student": a["student_name"].strip().lower() == b["student_name"].strip().lower()})
    pairs.sort(key=lambda p: -p["similarity"])
    return pairs[:100]


# ------------------------------------------------------------------ analytics
@router.get("/stats")
def stats(_: dict = Depends(auth.teacher_only)):
    with db.conn() as c:
        rows = [db.r_row(r) for r in c.execute("SELECT * FROM reviews ORDER BY id")]
        titles = {r["id"]: r["title"] for r in c.execute("SELECT id,title FROM questions")}
    finals = [r["final_score"] if r["final_score"] is not None else r["ai_score"] for r in rows]
    dist = Counter(finals)
    per_q, crit = {}, {}
    for r, f in zip(rows, finals):
        per_q.setdefault(titles.get(r["question_id"], "?"), []).append(f)
    for r in rows:
        for cs in r["criteria_scores"]:
            crit.setdefault(cs["name"], []).append(cs["score"] / cs["max"] if cs["max"] else 0)
    decided = [r for r in rows if r["teacher_status"] in {"approved", "overridden"}]
    over = [r for r in decided if r["teacher_status"] == "overridden"]
    agreement = {
        "decided": len(decided), "approved": len(decided) - len(over), "overridden": len(over),
        "rate": round((len(decided) - len(over)) / len(decided) * 100) if decided else None,
        "mae": round(sum(abs(r["final_score"] - r["ai_score"]) for r in over) / len(over), 2) if over else 0,
        "pairs": [{"id": r["id"], "ai": r["ai_score"], "final": r["final_score"]} for r in decided[-20:]]}
    return {
        "total": len(rows),
        "average": round(sum(finals) / len(finals), 2) if finals else 0,
        "flagged": sum(r["needs_teacher"] for r in rows),
        "pending": sum(r["teacher_status"] == "pending" for r in rows),
        "similar": sum((r["similarity"] or 0) >= SIM_FLAG for r in rows),
        "distribution": [dist.get(i, 0) for i in range(11)],
        "by_question": [{"title": k, "avg": round(sum(v) / len(v), 2), "count": len(v)} for k, v in per_q.items()],
        "criteria_strength": [{"name": k, "pct": round(sum(v) / len(v) * 100)} for k, v in crit.items()],
        "trend": [{"id": r["id"], "score": f} for r, f in zip(rows[-15:], finals[-15:])],
        "agreement": agreement}


@router.get("/export.csv")
def export_csv(_: dict = Depends(auth.teacher_only)):
    with db.conn() as c:
        rows = [db.r_row(r) for r in c.execute("SELECT * FROM reviews ORDER BY id")]
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["id", "date", "student", "question_id", "ai_score", "final_score", "status",
                "teacher_status", "similarity", "mode"])
    def safe(v):  # stop spreadsheet formula injection
        return "'" + v if isinstance(v, str) and v[:1] in "=+-@" else v
    for r in rows:
        w.writerow([r["id"], r["created_at"], safe(r["student_name"]), r["question_id"], r["ai_score"],
                    r["final_score"], r["status"], r["teacher_status"], r["similarity"], r["mode"]])
    return RawResponse(out.getvalue(), media_type="text/csv",
                       headers={"Content-Disposition": 'attachment; filename="reviews.csv"'})
