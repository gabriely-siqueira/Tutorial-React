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
from enum import Enum

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

class TaskPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"

class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"

class TaskCreate(BaseModel):
    description: str
    priority: TaskPriority = TaskPriority.medium
    due_date: Optional[datetime] = None

class TaskUpdate(BaseModel):
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[datetime] = None

class TaskResponse(TaskCreate):
    id: str
    created_at: datetime
    updated_at: datetime
    user_id: str
    status: TaskStatus

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
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            priority TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            due_date TIMESTAMP,
            user_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

# Rotas de autenticação (mantidas iguais)
@app.post("/signup", status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db: sqlite3.Connection = Depends(get_db)):
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

# Rotas de tarefas
@app.get("/tasks", response_model=list[TaskResponse])
async def get_tasks(
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    db: sqlite3.Connection = Depends(get_db),
    current_user: sqlite3.Row = Depends(get_current_user)
):
    query = "SELECT * FROM tasks WHERE user_id = ?"
    params = [current_user["id"]]
    
    if status:
        query += " AND status = ?"
        params.append(status)
    if priority:
        query += " AND priority = ?"
        params.append(priority)
    
    query += " ORDER BY created_at DESC"
    tasks = db.execute(query, params).fetchall()
    return [dict(task) for task in tasks]

@app.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task: TaskCreate,
    db: sqlite3.Connection = Depends(get_db),
    current_user: sqlite3.Row = Depends(get_current_user)
):
    task_id = str(uuid.uuid4())
    created_at = updated_at = datetime.now()
    
    db.execute(
        """INSERT INTO tasks 
           (id, description, priority, status, due_date, user_id, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (task_id, task.description, task.priority, "pending", 
         task.due_date, current_user["id"], created_at, updated_at)
    )
    db.commit()
    
    task_data = task.dict()
    return {
        "id": task_id,
        **task_data,
        "status": "pending",
        "user_id": current_user["id"],
        "created_at": created_at,
        "updated_at": updated_at
    }

@app.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    db: sqlite3.Connection = Depends(get_db),
    current_user: sqlite3.Row = Depends(get_current_user)
):
    task = db.execute(
        "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
        (task_id, current_user["id"])
    ).fetchone()
    
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    
    return dict(task)

@app.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    db: sqlite3.Connection = Depends(get_db),
    current_user: sqlite3.Row = Depends(get_current_user)
):
    # Verifica se a tarefa existe e pertence ao usuário
    task = db.execute(
        "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
        (task_id, current_user["id"])
    ).fetchone()
    
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    
    # Prepara os campos para atualização
    update_fields = {}
    for field, value in task_update.dict(exclude_unset=True).items():
        if value is not None:
            update_fields[field] = value
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    
    update_fields["updated_at"] = datetime.now()
    
    # Constrói a query dinamicamente
    set_clause = ", ".join(f"{field} = ?" for field in update_fields)
    query = f"UPDATE tasks SET {set_clause} WHERE id = ? AND user_id = ?"
    
    db.execute(
        query,
        (*update_fields.values(), task_id, current_user["id"])
    )
    db.commit()
    
    # Retorna a tarefa atualizada
    updated_task = db.execute(
        "SELECT * FROM tasks WHERE id = ?",
        (task_id,)
    ).fetchone()
    
    return dict(updated_task)

@app.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    db: sqlite3.Connection = Depends(get_db),
    current_user: sqlite3.Row = Depends(get_current_user)
):
    result = db.execute(
        "DELETE FROM tasks WHERE id = ? AND user_id = ?",
        (task_id, current_user["id"])
    )
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    
    return None

@app.get("/tasks/overview")
async def get_tasks_overview(
    db: sqlite3.Connection = Depends(get_db),
    current_user: sqlite3.Row = Depends(get_current_user)
):
    try:
        # Contagem por status (garante valores padrão para todos os status)
        status_counts = {
            "pending": 0,
            "in_progress": 0,
            "completed": 0
        }
        status_db = db.execute(
            """SELECT status, COUNT(*) as count 
               FROM tasks 
               WHERE user_id = ?
               GROUP BY status""",
            (current_user["id"],)
        ).fetchall()
        status_counts.update({row["status"]: row["count"] for row in status_db})
        
        # Contagem por prioridade (garante valores padrão)
        priority_counts = {
            "high": 0,
            "medium": 0,
            "low": 0
        }
        priority_db = db.execute(
            """SELECT priority, COUNT(*) as count 
               FROM tasks 
               WHERE user_id = ?
               GROUP BY priority""",
            (current_user["id"],)
        ).fetchall()
        priority_counts.update({row["priority"]: row["count"] for row in priority_db})
        
        # Tarefas próximas
        upcoming_tasks = db.execute(
            """SELECT id, description, due_date 
               FROM tasks 
               WHERE user_id = ? AND due_date BETWEEN ? AND ? 
               ORDER BY due_date ASC""",
            (current_user["id"], datetime.now(), datetime.now() + timedelta(days=3))
        ).fetchall()
        
        return {
            "status_counts": status_counts,
            "priority_counts": priority_counts,
            "upcoming_tasks": [dict(task) for task in upcoming_tasks]
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao gerar overview: {str(e)}"
        )
    
    return {
        "status_counts": {row["status"]: row["count"] for row in status_counts},
        "priority_counts": {row["priority"]: row["count"] for row in priority_counts},
        "upcoming_tasks": [dict(task) for task in upcoming_tasks]
    }