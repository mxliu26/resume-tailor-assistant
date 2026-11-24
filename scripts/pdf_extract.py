"""Read one text PDF from stdin. No input files are written to disk."""
import io
import json
import sys


def emit(payload):
    print(json.dumps(payload, ensure_ascii=True))


try:
    from pypdf import PdfReader
except ImportError:
    emit({"error": "PDF 解析依赖未安装。请执行 python -m pip install pypdf，或直接粘贴简历文本。"})
    sys.exit(2)

try:
    data = sys.stdin.buffer.read()
    reader = PdfReader(io.BytesIO(data), strict=False)
    if reader.is_encrypted and not reader.decrypt(""):
        raise ValueError("该 PDF 已加密，请先移除密码或粘贴简历文本。")
    if len(reader.pages) > 50:
        raise ValueError("PDF 超过 50 页，请缩减文件或粘贴需要处理的文本。")
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30000
    texts = []
    size = 0
    for page in reader.pages:
        page_text = page.extract_text() or ""
        size += len(page_text) + 2
        if size > limit:
            raise ValueError(f"PDF 文本超过 {limit} 字，请缩减文件；未截断分析。")
        texts.append(page_text)
    text = "\n\n".join(texts).strip()
    if len(text) < 10:
        raise ValueError("无法提取有效文字；扫描件暂不支持，请粘贴简历文本。")
    emit({"text": text})
except ValueError as exc:
    emit({"error": str(exc)})
    sys.exit(1)
except Exception:
    emit({"error": "PDF 读取失败，文件可能损坏或不含可提取的文字。请尝试粘贴文本。"})
    sys.exit(1)
