"""User and authentication domain models.

Defines schemas for authentication requests, sanitized user profiles,
role definitions, and token payloads. Plaintext passwords and cryptographic
hashes are strictly excluded from all public response models.
"""

from __future__ import annotations

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class UserRole(str, Enum):
    """Allowed backend-assigned roles within the CIT management system."""
    ADMIN = "admin"
    DEPARTMENT_COORDINATOR = "department_coordinator"
    FACULTY = "faculty"
    CLUB_REPRESENTATIVE = "club_representative"


class UserBase(BaseModel):
    """Base user properties common across representations."""
    email: str = Field(..., description="Unique email address")
    full_name: str = Field(..., description="Display name of user")
    role: UserRole = Field(..., description="Backend-assigned user role")
    department: str | None = Field(default=None, description="Academic department (e.g. CSE)")
    club: str | None = Field(default=None, description="Associated student organization (e.g. Spectra)")
    faculty_id: str | None = Field(default=None, description="Associated faculty identifier (e.g. F01)")
    is_active: bool = Field(default=True, description="Account active status")
    is_verified: bool = Field(default=True, description="Account email verification status")


class UserResponse(UserBase):
    """Sanitized user information returned in API responses.
    
    Plaintext passwords, password hashes, and salts are strictly excluded.
    """
    id: str = Field(..., description="Unique user identifier")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")


class LoginRequest(BaseModel):
    """Credentials submitted during authentication."""
    email: str = Field(..., description="Registered account email")
    password: str = Field(..., min_length=6, description="Account password")


class SignUpRequest(BaseModel):
    """Payload submitted when registering a new account."""
    email: str = Field(..., min_length=3, description="Valid registered account email")
    password: str = Field(..., min_length=6, description="Account password (at least 6 characters)")
    full_name: str | None = Field(default=None, description="Display full name")
    role: UserRole = Field(default=UserRole.FACULTY, description="Assigned role (faculty or club_representative)")
    department: str | None = Field(default="CSE", description="Academic department")
    club: str | None = Field(default=None, description="Associated club")


class TokenResponse(BaseModel):
    """Session authentication payload returned upon successful login."""
    access_token: str = Field(..., description="Bearer session access token")
    token_type: str = Field(default="bearer", description="Token authorization type")
    user: UserResponse = Field(..., description="Sanitized profile of the authenticated user")


class DemoAccountPublicInfo(BaseModel):
    """Public metadata describing a judge demo account.
    
    Contains role and description for UI quick-selection. Never includes passwords.
    """
    email: str = Field(..., description="Demo account email")
    full_name: str = Field(..., description="Account title")
    role: UserRole = Field(..., description="Assigned role")
    department: str | None = Field(default=None, description="Associated department")
    club: str | None = Field(default=None, description="Associated club")
    dashboard_scope: str = Field(..., description="Overview of accessible modules and features")

