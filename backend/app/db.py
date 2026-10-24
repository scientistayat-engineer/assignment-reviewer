"""SQLite persistence (stdlib only)."""
import json
import sqlite3
from contextlib import contextmanager

from .config import DB_PATH, settings

SEED = [
    ("Supervised vs Unsupervised Learning",
     "Explain supervised and unsupervised learning. Give one example of each.",
     [("Supervised explanation", 3, "labeled data, learns mapping from inputs to known outputs"),
      ("Unsupervised explanation", 3, "unlabeled data, finds patterns structure clusters"),
      ("Supervised example", 2, "e.g. spam classification, price regression"),
      ("Unsupervised example", 2, "e.g. customer clustering segmentation")]),
    ("Overfitting",
     "What is overfitting and how can it be reduced?",
     [("Definition", 4, "model memorizes training data and fails to generalize to new data"),
      ("Causes", 2, "complex model, small noisy data"),
      ("Remedies", 4, "regularization, more data, cross validation, early stopping, dropout")]),
]


@contextmanager
def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init():
    with conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS questions(
            id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, text TEXT, criteria TEXT);
        CREATE TABLE IF NOT EXISTS reviews(
            id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            question_id INTEGER, student_name TEXT, answer TEXT, criteria_scores TEXT,
            ai_score INTEGER, final_score INTEGER, feedback TEXT, improvement TEXT,
            status TEXT, needs_teacher INTEGER, teacher_status TEXT DEFAULT 'none',
            teacher_note TEXT DEFAULT '', mode TEXT, run_id TEXT);
        """)
        c.execute("""CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, display_name TEXT,
            role TEXT, password_hash TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
        cols = {r[1] for r in c.execute("PRAGMA table_info(reviews)")}
        for name, ddl in [("user_id", "INTEGER"), ("similarity", "REAL DEFAULT 0"),
                          ("similar_to", "INTEGER"), ("prev_score", "INTEGER")]:
            if name not in cols:
                c.execute(f"ALTER TABLE reviews ADD COLUMN {name} {ddl}")
        from .services.auth import hash_password
        row = c.execute("SELECT id FROM users WHERE username=?", (settings.teacher_username,)).fetchone()
        ph = hash_password(settings.teacher_password)
        if row:
            c.execute("UPDATE users SET password_hash=?, role='teacher' WHERE id=?", (ph, row["id"]))
        else:
            c.execute("INSERT INTO users(username,display_name,role,password_hash) VALUES(?,?,?,?)",
                      (settings.teacher_username, "Teacher", "teacher", ph))
        if c.execute("SELECT COUNT(*) FROM questions").fetchone()[0] == 0:
            for title, text, crit in SEED:
                crits = [{"name": n, "max_points": m, "description": d} for n, m, d in crit]
                c.execute("INSERT INTO questions(title,text,criteria) VALUES(?,?,?)",
                          (title, text, json.dumps(crits)))


def q_row(r):
    return {"id": r["id"], "title": r["title"], "text": r["text"], "criteria": json.loads(r["criteria"])}


def r_row(r):
    d = dict(r)
    d["criteria_scores"] = json.loads(d["criteria_scores"] or "[]")
    d["needs_teacher"] = bool(d["needs_teacher"])
    return d
