from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter(tags=["page"])

TEMPLATES = Path(__file__).resolve().parent / "templates"


@router.get("/")
async def home_page():
    return FileResponse(TEMPLATES / "index.html")


@router.get("/login")
async def login_page():
    return FileResponse(TEMPLATES / "login.html")


@router.get("/register")
async def register_page():
    return FileResponse(TEMPLATES / "register.html")

@router.get("/experience/create")
async def experience_create_page():
    return FileResponse(TEMPLATES / "experience_create.html")

@router.get("/experience/me")
async def experience_my_page():
    return FileResponse(TEMPLATES / "experience_me.html")

@router.get("/experience/{experience_id}")
async def experience_detail_page():
    return FileResponse(TEMPLATES / "experience_detail.html")

# 자소서 문항 목록 및 작성 현황 페이지
@router.get("/job-postings/{job_posting_id}/cover-letter")
async def cover_letter_page(job_posting_id: int):
    return FileResponse(TEMPLATES / "cover_letter.html")


# 자소서 생성 및 문항 등록 페이지
@router.get("/job-postings/{job_posting_id}/cover-letter/create")
async def cover_letter_create_page(job_posting_id: int):
    return FileResponse(TEMPLATES / "cover_letter_create.html")


# 개별 자소서 문항 상세 페이지 (AI 작성, 추가 질문 답변, 초안 수정)
@router.get("/cover-letter/questions/{question_id}")
async def cover_letter_question_page(question_id: int):
    return FileResponse(TEMPLATES / "cover_letter_question.html")


