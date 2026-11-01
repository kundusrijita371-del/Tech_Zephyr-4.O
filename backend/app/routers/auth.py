"""Authentication and Session Management API router.

Mounted under /api/v1/auth.
Exposes endpoints for user authentication, session verification, logout,
and public metadata for pre-configured judge demo accounts.
"""

from __future__ import annotations

from typing import Annotated, Any
from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.user import (
    DemoAccountPublicInfo,
    LoginRequest,
    SignUpRequest,
    TokenResponse,
    UserResponse,
    UserRole,
)
from app.services.auth_service import AuthService
from app.services.seed_demo import get_demo_accounts_metadata

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)] = None,
) -> UserResponse:
    """Dependency that extracts and verifies Bearer session token."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    user = AuthService.get_user_by_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)] = None,
) -> UserResponse | None:
    """Dependency that extracts user if Bearer token is provided, or returns None if omitted."""
    if not credentials or not credentials.credentials:
        return None
    return AuthService.get_user_by_token(credentials.credentials)


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account and issue active session token",
)
def signup(request: SignUpRequest) -> TokenResponse:
    """Create a new user account with hashed credentials and issue session token."""
    try:
        user = AuthService.register_user(
            email=request.email,
            password=request.password,
            full_name=request.full_name,
            role=request.role,
            department=request.department,
            club=request.club,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    token = AuthService.create_session(user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=user,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and issue session token",
)
def login(request: LoginRequest) -> TokenResponse:
    """Verify email and password; return access token and sanitized user profile."""
    user = AuthService.authenticate_user(request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = AuthService.create_session(user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=user,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile",
)
def get_me(current_user: Annotated[UserResponse, Depends(get_current_user)]) -> UserResponse:
    """Return the profile and permissions of the currently authenticated user."""
    return current_user


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Invalidate current session token",
)
def logout(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)] = None,
) -> dict[str, str]:
    """Invalidate active session token upon user logout."""
    if credentials and credentials.credentials:
        AuthService.invalidate_session(credentials.credentials)
    return {"status": "ok", "message": "Successfully logged out."}


@router.get(
    "/demo-accounts",
    response_model=list[DemoAccountPublicInfo],
    status_code=status.HTTP_200_OK,
    summary="List available judge demo accounts and their roles",
)
def list_demo_accounts() -> list[DemoAccountPublicInfo]:
    """Return metadata describing pre-configured judge demo accounts.
    
    CRITICAL: Passwords and sensitive credentials are NEVER returned.
    """
    return get_demo_accounts_metadata()

