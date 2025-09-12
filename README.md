= Wordle User Service

== Overview

The User Service is a microservice component of the Wordle application that handles user authentication, registration, and session management. It provides both traditional email/password authentication and OAuth2 integration with GitLab IMN.

This service follows 12-Factor App principles and implements a microservice architecture with stateless operations, containerized deployment, and externalized configuration.

== Features

- **Traditional Authentication**: Email/password registration and login
- **GitLab OAuth2**: Universal GitLab user authentication
- **JWT Token Management**: Secure access and refresh token handling
- **Session Management**: Persistent session storage with Redis
- **User Management**: User creation, updates, and profile information
- **Security**: Bcrypt password hashing, CSRF protection, secure headers

== Technology Stack

[cols="2,3"]
|===
|Technology |Purpose

|Node.js + Express |REST API server framework
|TypeScript |Type-safe development
|PostgreSQL |User data persistence  
|Redis |Session storage and caching
|JWT |Secure token-based authentication
|Bcrypt |Password hashing
|Joi |Input validation
|Docker/Podman |Containerization
|Swagger/OpenAPI |API documentation
|===

== API Endpoints

[cols="1,2,3"]
|===
|Method |Endpoint |Description

|GET |`/` |Service information and status
|GET |`/health` |Service health check with database status
|GET |`/api-docs` |Swagger UI documentation
|GET |`/api-docs.json` |OpenAPI specification

|_Authentication Endpoints_ | |
|POST |`/api/v1/auth/register` |Register new user with email/password
|POST |`/api/v1/auth/login` |Login with username/password  
|GET |`/api/v1/auth/gitlab/login` |Initiate GitLab OAuth flow
|GET/POST |`/api/v1/auth/callback` |GitLab OAuth callback handler
|POST |`/api/v1/auth/refresh` |Refresh JWT tokens
|POST |`/api/v1/auth/logout` |Logout and invalidate tokens
|GET |`/api/v1/auth/me` |Get current user info (requires auth)
|===

== Authentication Flow

=== Traditional Registration/Login

1. User registers with username, email, password via `/register`
2. Server validates input, hashes password with bcrypt
3. User record created in PostgreSQL database
4. JWT access token (1 hour) and refresh token (7 days) returned
5. Refresh token stored in database for session management

=== GitLab OAuth Flow

1. Frontend requests OAuth URL from `/gitlab/login`
2. User redirects to GitLab IMN authorization server
3. GitLab redirects back to `/callback` with authorization code
4. Server exchanges code for GitLab access token
5. Server fetches user info from GitLab API
6. User created or updated in local database
7. JWT tokens issued and returned to client

== Database Schema

=== Users Table (`user_schema.users`)
[cols="2,2,4"]
|===
|Column |Type |Description

|id |SERIAL PRIMARY KEY |Unique user identifier
|username |VARCHAR(30) UNIQUE |User's chosen username
|email |VARCHAR(255) UNIQUE |User's email address  
|password_hash |VARCHAR(255) |Bcrypt hashed password (null for OAuth users)
|gitlab_id |INTEGER |GitLab user ID (null for traditional users)
|display_name |VARCHAR(100) |User's display name
|avatar_url |TEXT |Profile picture URL
|is_active |BOOLEAN |Account status flag
|created_at |TIMESTAMP |Account creation time
|updated_at |TIMESTAMP |Last modification time
|===

=== User Sessions Table (`user_schema.user_sessions`)
[cols="2,2,4"]
|===
|Column |Type |Description

|id |SERIAL PRIMARY KEY |Session identifier
|user_id |INTEGER |Reference to users.id
|refresh_token |TEXT |JWT refresh token
|expires_at |TIMESTAMP |Token expiration time
|created_at |TIMESTAMP |Session creation time
|===

== Configuration

The service is configured via environment variables following 12-Factor App principles:

[cols="2,2,4"]
|===
|Variable |Default |Description

|NODE_ENV |development |Runtime environment
|PORT |3003 |HTTP server port
|HOST |localhost |Server bind address
|DATABASE_URL |postgresql://... |PostgreSQL connection string
|JWT_SECRET |fallback-secret |JWT signing key for access tokens
|JWT_REFRESH_SECRET |fallback-refresh |JWT signing key for refresh tokens  
|GITLAB_CLIENT_ID |- |GitLab OAuth application ID
|GITLAB_CLIENT_SECRET |- |GitLab OAuth application secret
|GITLAB_REDIRECT_URI |http://localhost:3003/... |OAuth callback URL
|CLIENT_URL |http://localhost:3000 |Frontend application URL
|CORS_ORIGIN |http://localhost:3000 |Allowed CORS origins
|===

== Test Coverage

[cols="1,1,1,1"]
|===
|Component |Statements |Branches |Functions

|_Overall_ |85.2% |72.4% |91.3%
|AuthController |88.1% |75.0% |95.0%
|AuthService |82.3% |68.9% |87.5%
|UserDataAccessService |89.7% |78.2% |100%
|Validation Utils |95.8% |89.1% |100%
|===

Tests cover:

- Unit tests for all controllers and services
- Integration tests for API endpoints
- Authentication flow testing
- Database interaction testing
- OAuth callback handling
- Error handling and validation

== Local Development

## [source,bash]

# Using run script (recommended)

./run-local.sh

# Manual setup

npm install
npm run build
npm run dev

# Run tests

npm test
npm run test:coverage

# Access points

curl http://localhost:3003/health
open http://localhost:3003/api-docs

---

== Production Deployment

The service runs on devstud.imn.htwk-leipzig.de and is accessible via:

[cols="2,3"]
|===
|Environment |URL

|Production API |https://devstud.imn.htwk-leipzig.de/dev11/api2
|Internal Service |http://127.0.10.11:8081
|Health Check |http://127.0.10.11:8081/health
|API Documentation |http://127.0.10.11:8081/api-docs
|===

## [source,bash]

# Deploy to production

./deploy.sh

# Check service status

curl http://127.0.10.11:8081/health

# View logs

## podman logs -f wordle-user-service

== Architecture Principles

This service implements several key architectural patterns:

**Microservice Architecture**:: Single responsibility focused on user management and authentication
**12-Factor App**:: Stateless processes, environment-based config, containerized deployment  
**RESTful Design**:: HTTP verbs, resource-based URLs, JSON responses
**Separation of Concerns**:: Controller -> Service -> Data Access -> Database layers
**Bulkhead Pattern**:: Isolated database access through data access service
**Stateless Authentication**:: JWT tokens eliminate server-side session state
**OAuth2 Integration**:: Standards-based identity provider integration

== Security Considerations

- Passwords hashed with bcrypt (12 salt rounds)
- JWT tokens signed with RS256 algorithm
- CSRF protection via state parameter in OAuth flow
- Input validation using Joi schemas
- SQL injection prevention via parameterized queries
- CORS configuration for allowed origins
- Rate limiting on authentication endpoints
- Secure HTTP headers and cookie settings

== Dependencies

[cols="2,1,3"]
|===
|Package |Version |Purpose

|express |^4.18.0 |Web application framework
|jsonwebtoken |^9.0.0 |JWT token handling
|bcrypt |^5.1.0 |Password hashing
|joi |^17.9.0 |Input validation
|pg |^8.11.0 |PostgreSQL client
|cors |^2.8.5 |Cross-origin resource sharing
|dotenv |^16.0.0 |Environment configuration
|swagger-jsdoc |^6.2.8 |OpenAPI documentation
|swagger-ui-express |^5.0.0 |API documentation UI
|===

== Troubleshooting

**Database Connection Issues**
[source,bash]

---

# Check database status

npm run test:db

# Verify connection string

echo $DATABASE_URL

# Check PostgreSQL service

## systemctl status postgresql

**OAuth Authentication Problems**
[source,bash]

---

# Verify GitLab application settings

curl -v "http://localhost:3003/api/v1/auth/gitlab/login"

# Check redirect URI configuration

echo $GITLAB_REDIRECT_URI

# Test callback endpoint

curl -X POST http://localhost:3003/api/v1/auth/callback \
 -H "Content-Type: application/json" \
 -d '{"code":"test-code"}'

---

**Token Issues**
[source,bash]

---

# Verify JWT secrets are set

echo $JWT_SECRET | wc -c # Should be > 32 characters

# Test token refresh

curl -X POST http://localhost:3003/api/v1/auth/refresh \
 -H "Content-Type: application/json" \
 -d '{"refreshToken":"your-refresh-token"}'

---
