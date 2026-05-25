from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    role: str = Field("driver", pattern="^(admin|dispatcher|driver)$")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str

class DeliveryCreate(BaseModel):
    destination: str
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    priority: str = Field("Medium", pattern="^(Low|Medium|High|Critical)$")
    weight: float = Field(..., gt=0.0)
    driver: str

class DeliveryResponse(BaseModel):
    id: str
    destination: str
    lat: float
    lng: float
    priority: str
    weight: float
    driver: str
    status: str
    eta: str

class AcoParamsSchema(BaseModel):
    alpha: float = Field(1.0, ge=0.0, le=5.0)
    beta: float = Field(2.0, ge=0.0, le=5.0)
    rho: float = Field(0.1, ge=0.0, le=1.0)
    ants: int = Field(20, ge=1, le=100)
    iterations: int = Field(50, ge=1, le=500)
    capacity: float = Field(1500.0, ge=10.0)

class OptimizationResult(BaseModel):
    optimal_routes: List[List[int]]
    distance_km: float
    unserved_deliveries: int
    computation_ms: float
