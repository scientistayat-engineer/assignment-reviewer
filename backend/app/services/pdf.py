"""Result PDF (ReportLab)."""
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def review_pdf(review: dict, question: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm, title="Assignment Review")
    ss = getSampleStyleSheet()
    h = ParagraphStyle("h", parent=ss["Title"], textColor=colors.HexColor("#1e1b4b"), fontSize=22)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], textColor=colors.HexColor("#4f46e5"))
    body = ss["BodyText"]
    final = review["final_score"] if review["final_score"] is not None else review["ai_score"]
    s = [Paragraph("Assignment Review Report", h),
         Paragraph(f"Student: <b>{escape(review['student_name'])}</b> &nbsp;|&nbsp; "
                   f"Date: {review['created_at']} &nbsp;|&nbsp; Review #{review['id']}", body),
         Spacer(1, 10), Paragraph("Question", h2),
         Paragraph(escape(question["text"]), body), Spacer(1, 6),
         Paragraph(f"Final score: <b>{final}/10</b> (AI suggestion: {review['ai_score']}/10)", h2)]
    rows = [["Criterion", "Score", "Comment"]] + [
        [c["name"], f"{c['score']}/{c['max']}", Paragraph(escape(c["comment"]), body)]
        for c in review["criteria_scores"]]
    t = Table(rows, colWidths=[5.5*cm, 2*cm, 9.5*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c7d2fe")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#eef2ff")])]))
    s += [t, Spacer(1, 10), Paragraph("Student answer", h2), Paragraph(escape(review["answer"]), body),
          Paragraph("Feedback", h2), Paragraph(escape(review["feedback"]), body),
          Paragraph("Suggested improvement", h2), Paragraph(escape(review["improvement"]), body)]
    if review["teacher_status"] != "none":
        s += [Paragraph("Teacher decision", h2),
              Paragraph(f"{review['teacher_status'].title()} - {escape(review['teacher_note'] or 'no note')}", body)]
    s += [Spacer(1, 14), Paragraph("<i>Scores are suggestions; the teacher makes the final decision.</i>", body)]
    doc.build(s)
    return buf.getvalue()
