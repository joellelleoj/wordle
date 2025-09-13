# =============================================================================

# one-pager.md - University Website Summary

# =============================================================================

# Wordle Game - Microservices Implementation

## Project Summary

A complete implementation of the popular Wordle word-guessing game, developed as a modern microservices application for the Web Engineering (C227) course at HTWK Leipzig. The project demonstrates advanced web development concepts including containerization, API gateway patterns, and cloud-native architecture.

## Key Features

- **Classic Wordle Gameplay**: Daily 5-letter word puzzles with color-coded feedback
- **User Authentication**: Secure OAuth2 integration with GitLab IMN
- **Statistics Tracking**: Personal performance metrics and global leaderboards
- **Social Features**: Share game results and follow other players
- **Real-time Updates**: Live statistics and instant game feedback

## Technical Highlights

### Architecture

- **Microservices Design**: Six independent services with clear separation of concerns
- **API Gateway Pattern**: Centralized routing, authentication, and rate limiting
- **Containerization**: Complete Docker-based deployment with orchestration
- **Database Separation**: Dedicated databases for different domains

### Technologies Used

- **Frontend**: React with TypeScript and responsive design
- **Backend**: Node.js microservices with Express.js
- **Databases**: PostgreSQL for persistence, Redis for caching
- **Security**: JWT authentication, OAuth2 integration, rate limiting
- **DevOps**: GitLab CI/CD, automated testing, health monitoring

### 12-Factor App Compliance

The application strictly follows the 12-Factor App methodology:

- Environment-based configuration
- Stateless processes with external state storage
- Port binding and horizontal scalability
- Comprehensive logging and monitoring

## Live Demo

🌐 **Access the application**: [http://devstud.imn.htwk-leipzig.de/dev11](http://devstud.imn.htwk-leipzig.de/dev11)

## Team & Development

**Development Team**: Web Engineering Student Group  
**Course**: Web Engineering (C227) - Summer Semester 2025  
**Institution**: HTWK Leipzig  
**Supervisor**: Prof. Dr. Andreas Both

The project showcases modern web development practices and enterprise-grade architecture patterns, making it an excellent demonstration of full-stack development capabilities and cloud-native application design.
