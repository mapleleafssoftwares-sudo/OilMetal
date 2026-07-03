import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, certificados, empresas, no_conformidades

app = FastAPI(title="Gestión de Certificados API")

# Configurar CORS
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://oil-metal-certificaciones.onrender.com",
    "https://oilmetaldocs.com",
    "https://www.oilmetaldocs.com",
    "https://oilmetaldocuments.onrender.com",
]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url and frontend_url not in origins:
    origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(certificados.router)
app.include_router(empresas.router)
app.include_router(no_conformidades.router)

@app.get("/")
def read_root():
    return {"message": "Bienvenido a la API de Gestión de Certificados"}
