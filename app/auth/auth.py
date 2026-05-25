import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Password hashing configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration keys
SECRET_KEY = os.getenv("JWT_SECRET", "supersecurelogisticssecretkey128bit")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

security_bearer = HTTPBearer()

def hash_password(password: str) -> str:
    """
    Encrypts password string using bcrypt hashing algorithms.
    """
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Compares cleartext password with hashed database values.
    """
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Signs JWT authorization tokens with custom expiry times.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Validates signature, expiration, and resolves claims of incoming JWT string.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token signature expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user_claims(credentials: HTTPAuthorizationCredentials = Security(security_bearer)) -> Dict[str, Any]:
    """
    FastAPI dependency resolving valid claims out of authorization headers.
    """
    return decode_access_token(credentials.credentials)

def check_role_permissions(allowed_roles: list):
    """
    Dependency generator validating role-based authorization scopes.
    """
    def dependency(claims: Dict[str, Any] = Security(get_current_user_claims)):
        user_role = claims.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Allowed roles: {allowed_roles}"
            )
        return claims
    return dependency
