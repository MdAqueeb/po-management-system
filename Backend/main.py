from fastapi import FastAPI
import models
from database import engine
from routes import router
from fastapi.middleware.cors import CORSMiddleware


# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Purchase Order Management System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(router)


@app.get("/")
def read_root():
    return {"message": "Welcome to the Purchase Order Management System API"}
