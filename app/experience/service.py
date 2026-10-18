from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.agents.experience.schema import (
    InitAgentInput,
    FinalAgentInput,
    STAR,
    FollowUpAnswer
)
from app.agents.experience.final_agent import run_improve_experience
from app.agents.experience.initial_agent import analyze_initial_experience

from app.experience.model import Experience, FollowUp
from app.experience.schema import FollowUpQuestionWithID, FinalUserInput, ExperienceUpdateInput

async def create_experience(
    db: AsyncSession,
    data: InitAgentInput,
    user_id: int
):
    # 1. AI 분석
    res = await analyze_initial_experience(data)

    # 2. 경험 저장
    experience = Experience(
        user_id=user_id,
        title=data.title,
        original_exp=data.exp,
        situation=res.star.situation,
        task=res.star.task,
        action=res.star.action,
        result=res.star.result
    )

    db.add(experience)
    await db.flush()

    # 3. 후속 질문 저장
    follow_ups = [
        FollowUp(
            experience_id=experience.id,
            type=q.type,
            question=q.question
        )
        for q in res.follow_up
    ]

    db.add_all(follow_ups)
    await db.flush()

    # 4. 응답 생성
    result = {
        "experience_id": experience.id,
        "star": res.star,
        "follow_up": [
            FollowUpQuestionWithID(
                question_id=q.id,
                type=q.type,
                question=q.question
            )
            for q in follow_ups
        ]
    }

    await db.commit()
    return result


def match_question_answer(questions, answers):
    question_map = {q.id: q for q in questions}
    matched = []

    for item in answers:
        if item.question_id not in question_map:
            raise HTTPException(400, "유효하지 않은 질문 ID")

        question = question_map[item.question_id]
        question.answer = item.answer

        matched.append({
            "type": question.type,
            "question": question.question,
            "answer": item.answer
        })

    return matched


async def improve_experience(
    db: AsyncSession,
    data: FinalUserInput,
    user_id: int
):
    # 1. 경험 조회
    exp = await db.scalar(
        select(Experience).where(
            Experience.id == data.experience_id,
            Experience.user_id == user_id
        )
    )

    if not exp:
        raise HTTPException(404, "경험을 찾을 수 없습니다.")

    # 2. 질문 조회
    questions = (await db.scalars(
        select(FollowUp).where(
            FollowUp.experience_id == exp.id
        )
    )).all()

    # 3. 질문과 답변 매칭
    matched = match_question_answer(questions, data.follow_up)

    # 4. AI 입력 생성
    agent_input = FinalAgentInput(
        original_exp=exp.original_exp,
        star=STAR(
            situation=exp.situation,
            task=exp.task,
            action=exp.action,
            result=exp.result
        ),
        follow_up_answers=[
            FollowUpAnswer(**item)
            for item in matched
        ]
    )

    # 5. AI 실행
    res = await run_improve_experience(agent_input)

    # 6. 최종 STAR 및 태그 저장
    exp.situation = res.star.situation
    exp.task = res.star.task
    exp.action = res.star.action
    exp.result = res.star.result
    exp.tags = [tag.value for tag in res.tags]
    exp.status = "completed"

    result = {
        "experience_id": exp.id,
        "star": res.star,
        "tags": res.tags
    }

    await db.commit()
    return result



# 경험 목록 조회
async def get_experiences(db: AsyncSession, user_id: int):
    result = await db.scalars(
        select(Experience)
        .where(Experience.user_id == user_id)
        .order_by(Experience.id.desc())
    )

    return [
        {
            "experience_id": exp.id,
            "title": exp.title,
            "status": exp.status,
            "tags": exp.tags
        }
        for exp in result.all()
    ]


# 경험 상세 조회
async def get_experience(
    db: AsyncSession,
    experience_id: int,
    user_id: int
):
    exp = await db.scalar(
        select(Experience).where(
            Experience.id == experience_id,
            Experience.user_id == user_id
        )
    )

    if not exp:
        raise HTTPException(404, "경험을 찾을 수 없습니다.")

    questions = (await db.scalars(
        select(FollowUp).where(
            FollowUp.experience_id == exp.id
        ).order_by(FollowUp.id)
    )).all()

    return {
        "experience_id": exp.id,
        "title": exp.title,
        "original_exp": exp.original_exp,
        "star": {
            "situation": exp.situation,
            "task": exp.task,
            "action": exp.action,
            "result": exp.result
        },
        "tags": exp.tags,
        "status": exp.status,
        "follow_up": [
            {
                "question_id": q.id,
                "type": q.type,
                "question": q.question,
                "answer": q.answer
            }
            for q in questions
        ]
    }


# 경험 수정
async def update_experience(
    db: AsyncSession,
    experience_id: int,
    data: ExperienceUpdateInput,
    user_id: int
):
    exp = await db.scalar(
        select(Experience).where(
            Experience.id == experience_id,
            Experience.user_id == user_id
        )
    )

    if not exp:
        raise HTTPException(404, "경험을 찾을 수 없습니다.")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(exp, key, value)

    await db.commit()

    return {"message": "경험 수정 완료"}


# 경험 삭제
async def delete_experience(
    db: AsyncSession,
    experience_id: int,
    user_id: int
):
    exp = await db.scalar(
        select(Experience).where(
            Experience.id == experience_id,
            Experience.user_id == user_id
        )
    )

    if not exp:
        raise HTTPException(404, "경험을 찾을 수 없습니다.")

    # 연관된 후속 질문 먼저 삭제
    questions = (await db.scalars(
        select(FollowUp).where(
            FollowUp.experience_id == exp.id
        )
    )).all()

    for question in questions:
        await db.delete(question)

    await db.delete(exp)
    await db.commit()

    return {"message": "경험 삭제 완료"}