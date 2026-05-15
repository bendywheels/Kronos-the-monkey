from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ============ Models ============
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class RoundResultCreate(BaseModel):
    nickname: str
    survived: bool
    won: bool
    role: str            # 'survivor' | 'infected'
    survived_seconds: float
    bots_count: int
    survivors_left: int


class RoundResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nickname: str
    survived: bool
    won: bool
    role: str
    survived_seconds: float
    bots_count: int
    survivors_left: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LeaderboardEntry(BaseModel):
    nickname: str
    best_time: float
    wins: int
    games: int


# ============ Routes ============
@api_router.get("/")
async def root():
    return {"message": "KRONOS ARENA online"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check.get('timestamp'), str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


@api_router.post("/rounds", response_model=RoundResult)
async def submit_round(payload: RoundResultCreate):
    obj = RoundResult(**payload.model_dump())
    doc = obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.rounds.insert_one(doc)
    return obj


@api_router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def leaderboard(limit: int = 10):
    pipeline = [
        {"$group": {
            "_id": "$nickname",
            "best_time": {"$max": "$survived_seconds"},
            "wins": {"$sum": {"$cond": [{"$eq": ["$won", True]}, 1, 0]}},
            "games": {"$sum": 1},
        }},
        {"$sort": {"wins": -1, "best_time": -1}},
        {"$limit": limit},
    ]
    rows = await db.rounds.aggregate(pipeline).to_list(limit)
    return [
        LeaderboardEntry(
            nickname=r["_id"],
            best_time=float(r.get("best_time") or 0),
            wins=int(r.get("wins") or 0),
            games=int(r.get("games") or 0),
        ) for r in rows if r.get("_id")
    ]


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
