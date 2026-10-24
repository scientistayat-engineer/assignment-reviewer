"""Answer similarity (word 3-gram Jaccard) for copy detection."""
import re


def _norm(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def shingles(text: str, n: int = 3) -> set[tuple]:
    w = _norm(text)
    if len(w) < n:
        return {tuple(w)} if w else set()
    return {tuple(w[i:i + n]) for i in range(len(w) - n + 1)}


def similarity(a: str, b: str) -> float:
    sa, sb = shingles(a), shingles(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def most_similar(answer: str, others: list[dict]) -> tuple[float, int | None]:
    best, best_id = 0.0, None
    for o in others:
        s = similarity(answer, o["answer"])
        if s > best:
            best, best_id = s, o["id"]
    return round(best, 3), best_id
