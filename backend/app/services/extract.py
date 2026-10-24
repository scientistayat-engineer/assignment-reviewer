"""Text extraction from uploaded answer files (txt, md, pdf, docx)."""
from io import BytesIO

MAX_BYTES = 5 * 1024 * 1024


def extract_text(filename: str, data: bytes) -> str:
    name = filename.lower()
    if len(data) > MAX_BYTES:
        raise ValueError("File is larger than 5 MB")
    if name.endswith((".txt", ".md")):
        return data.decode("utf-8", errors="ignore").strip()
    if name.endswith(".pdf"):
        from pypdf import PdfReader
        return "\n".join((p.extract_text() or "") for p in PdfReader(BytesIO(data)).pages).strip()
    if name.endswith(".docx"):
        from docx import Document
        return "\n".join(p.text for p in Document(BytesIO(data)).paragraphs).strip()
    raise ValueError("Unsupported file type. Use .txt, .md, .pdf or .docx")
