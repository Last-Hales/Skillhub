# SkillHub - Skill Marketplace Platform

A comprehensive marketplace platform connecting skilled workers with customers who need their services.

## Features

### For Workers
- Complete profile with skills, services, and specializations
- Availability toggle to control when you accept jobs
- Rating system (1-5 stars) based on completed work
- Real-time notifications for new opportunities
- In-app messaging with customers
- Track completed jobs and earnings

### For Customers
- Browse and search available workers by skill and location
- Create job opportunities with detailed requirements
- Get matched with closest available workers automatically
- Rate workers after job completion
- In-app messaging to communicate with workers
- Track all active and completed opportunities

### General Features
- Secure authentication with JWT
- Real-time messaging system
- Comprehensive user profiles
- Customer service contact page
- Responsive design for mobile and desktop

## Tech Stack

### Backend
- Node.js & Express.js
- MongoDB
- Socket.io (real-time features)
- JWT Authentication
- Bcrypt (password hashing)

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- Responsive Design

## Installation & Setup

### Prerequisites
- Node.js (v14+)
- MongoDB running locally or MongoDB Atlas connection string
- npm or yarn

### Steps

1. **Clone/Download the project**
   ```bash
   cd "Skill Hub"
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   
   Edit `.env` file:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/skill-hub
   JWT_SECRET=your_secret_key_change_this_in_production
   NODE_ENV=development
   ```

   For MongoDB Atlas:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/skill-hub?retryWrites=true&w=majority
   ```

4. **Start MongoDB**
   
   Make sure MongoDB is running:
   ```bash
   # On Windows
   mongod
   
   # On Mac
   brew services start mongodb-community
   
   # On Linux
   sudo systemctl start mongod
   ```

5. **Start the Server**
   
   Development mode (with auto-reload):
   ```bash
   npm run dev
   ```
   
   Production mode:
   ```bash
   npm start
   ```

6. **Access the Application**
   
   Open your browser and go to:
   ```
   http://localhost:5000
   ```

## Project Structure

```
Skill Hub/
├── models/                  # MongoDB Schemas
│   ├── User.js
│   ├── Worker.js
│   ├── Opportunity.js
│   ├── Message.js
│   └── Rating.js
├── routes/                  # API Routes
│   ├── auth.js
│   ├── users.js
│   ├── workers.js
│   ├── opportunities.js
│   ├── messages.js
│   └── ratings.js
├── public/                  # Frontend Files
│   ├── index.html
│   ├── signup.html
│   ├── login.html
│   ├── dashboard.html
│   ├── create-opportunity.html
│   ├── messages.html
│   ├── profile.html
│   ├── contact.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── auth.js
│       ├── main.js
│       ├── dashboard.js
│       ├── profile.js
│       └── messaging.js
├── server.js               # Main Application File
├── package.json
├── .env                    # Environment Variables
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify token

### Users
- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/:userId` - Get user by ID

### Workers
- `GET /api/workers` - Get all available workers
- `GET /api/workers/:workerId` - Get worker details
- `GET /api/workers/user/:userId` - Get worker profile by user ID
- `PUT /api/workers/:workerId/availability` - Update availability
- `PUT /api/workers/:workerId/profile` - Update worker profile
- `GET /api/workers/search` - Search workers by skill/location

### Opportunities
- `POST /api/opportunities` - Create new opportunity
- `GET /api/opportunities` - Get all opportunities
- `GET /api/opportunities/:opportunityId` - Get opportunity details
- `POST /api/opportunities/:opportunityId/accept` - Accept job
- `PUT /api/opportunities/:opportunityId/complete` - Complete job
- `GET /api/opportunities/worker/list` - Get opportunities for worker

### Messages
- `POST /api/messages` - Send message
- `GET /api/messages` - Get all conversations
- `GET /api/messages/conversation/:userId` - Get specific conversation
- `PUT /api/messages/:messageId/read` - Mark message as read

### Ratings
- `POST /api/ratings` - Create rating
- `GET /api/ratings/worker/:workerId` - Get worker ratings
- `GET /api/ratings/opportunity/:opportunityId` - Get rating for opportunity

## User Types

### Worker Account
Required fields:
- Email
- Password
- Full Name
- Phone Number
- Address
- Country
- State
- Skills (comma-separated)
- Services
- Handwork/Specialization

### Customer Account
Required fields:
- Email
- Password
- Full Name
- Phone Number
- Address
- Country
- State

## Customer Service
- **WhatsApp**: 09015210112
- **Email**: skill.hub.gtt@gmail.com
- **Phone**: 09015210112

## Usage Guide

### For New Workers
1. Sign up as a worker with all required information
2. Complete your profile with skills and experience
3. Toggle availability to receive job notifications
4. Check new opportunities in dashboard
5. Accept jobs that match your expertise
6. Complete jobs and get rated by customers

### For New Customers
1. Sign up as a customer
2. Browse available workers on homepage
3. Search by skill or location
4. Create opportunities with job details
5. Communicate with interested workers
6. Mark jobs as complete
7. Rate workers after completion

## Security Notes

- Passwords are hashed using bcrypt
- JWT tokens for authentication
- Token expiration: 7 days
- Change JWT_SECRET in production
- Use environment variables for sensitive data
- Implement rate limiting in production

## Future Enhancements

- Payment integration (Stripe/PayPal)
- Video call feature
- Worker verification system
- Insurance/guarantee system
- Advanced analytics for workers
- Mobile app versions
- Push notifications
- Review media (photos/videos)

## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running
- Check connection string in .env
- Verify database credentials

### Port Already in Use
- Change PORT in .env
- Or kill process: `lsof -ti:5000 | xargs kill -9`

### CORS Errors
- Ensure frontend is accessing correct API URL
- Check CORS settings in server.js

## License
ISC

## Support
Contact us at: skill.hub.gtt@gmail.com
