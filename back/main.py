from fastapi import FastAPI, HTTPException, Depends, status, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
from datetime import datetime, timedelta
import uuid
import hashlib
import jwt
from typing import Optional
from contextlib import contextmanager

app = FastAPI()

SECRET_KEY = "sua_chave_secreta_super_segura"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Configuração do CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos de dados
class UserCreate(BaseModel):
    nome: str
    email: str
    senha: str

class UserLogin(BaseModel):
    email: str
    senha: str

class MessageCreate(BaseModel):
    title: str
    text: str

class MessageResponse(MessageCreate):
    id: str
    created_at: datetime
    user_id: str

# Conexão com o banco de dados (thread-safe)
@contextmanager
def get_db_connection():
    conn = sqlite3.connect('app.db', check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def get_db():
    with get_db_connection() as conn:
        yield conn

# Criação das tabelas
def init_db():
    with get_db_connection() as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            nome TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            senha TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            text TEXT NOT NULL,
            user_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
        """)
        conn.commit()

init_db()

def hash_senha(senha: str) -> str:
    return hashlib.sha256(senha.encode()).hexdigest()

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

async def get_current_user(authorization: str = Header(...), db: sqlite3.Connection = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token inválido")
    
    token = authorization[7:]
    payload = verify_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    
    user_id = payload.get("sub")
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    return user

# Rotas de autenticação
@app.post("/signup", status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db: sqlite3.Connection = Depends(get_db)):
    # Verifica se o email já existe
    existing_user = db.execute(
        "SELECT id FROM users WHERE email = ?", 
        (user.email,)
    ).fetchone()
    
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email já cadastrado"
        )
    
    user_id = str(uuid.uuid4())
    hashed_senha = hash_senha(user.senha)
    
    db.execute(
        "INSERT INTO users (id, nome, email, senha) VALUES (?, ?, ?, ?)",
        (user_id, user.nome, user.email, hashed_senha)
    )
    db.commit()
    
    return {"message": "Usuário criado com sucesso"}

@app.post("/login")
async def login(credentials: UserLogin, db: sqlite3.Connection = Depends(get_db)):
    user = db.execute(
        "SELECT * FROM users WHERE email = ?", 
        (credentials.email,)
    ).fetchone()
    
    if not user or hash_senha(credentials.senha) != user["senha"]:
        raise HTTPException(
            status_code=401,
            detail="Email ou senha incorretos"
        )
    
    token = create_access_token({"sub": user["id"]})
    return {"token": token, "token_type": "bearer"}

@app.get("/messages", response_model=list[MessageResponse])
async def read_messages(db: sqlite3.Connection = Depends(get_db)):
    messages = db.execute(
        "SELECT id, title, text, user_id, created_at FROM messages ORDER BY created_at DESC"
    ).fetchall()
    return [dict(message) for message in messages]

@app.post("/messages", response_model=MessageResponse)
async def create_message(
    message: MessageCreate,
    db: sqlite3.Connection = Depends(get_db),
    authorization: str = Header(...)
):
    # Verificação do token
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token inválido")
    
    token = authorization[7:]
    payload = verify_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    
    user_id = payload.get("sub")

    message_id = str(uuid.uuid4())
    created_at = datetime.now()
    
    db.execute(
        "INSERT INTO messages (id, title, text, user_id, created_at) VALUES (?, ?, ?, ?, ?)",
        (message_id, message.title, message.text, user_id, created_at)
    )
    db.commit()
    
    return {
        "id": message_id,
        "title": message.title,
        "text": message.text,
        "user_id": user_id,
        "created_at": created_at
    }