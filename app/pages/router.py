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

@router.get("/job-postings/create")
async def job_posting_create_page():
    return FileResponse(TEMPLATES / "job_posting_create.html")


@router.get("/job-postings/me")
async def job_posting_my_page():
    return FileResponse(TEMPLATES / "job_posting_me.html")


@router.get("/job-postings/{job_posting_id}")
async def job_posting_detail_page(job_posting_id: int):
    return FileResponse(TEMPLATES / "job_posting_detail.html")


