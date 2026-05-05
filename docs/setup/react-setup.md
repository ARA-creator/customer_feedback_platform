# React Dashboard Setup Guide

## Overview
The React dashboard is now fully connected to the Flask backend API. All data is fetched in real-time from the Flask API endpoints.

## Quick Start

### 1. Start Flask Backend
```bash
cd /home/araba/customer_feedback_platform
source .venv/bin/activate
python run_dev.py
```
Flask will run on `http://localhost:5000`

### 2. Start React Frontend
```bash
cd /home/araba/customer_feedback_platform/react_dashboard
npm run dev
```
React will run on `http://localhost:5173`

### 3. Access Dashboard
Open `http://localhost:5173` in your browser.

## API Endpoints Used

The React dashboard connects to these Flask API endpoints:

- **GET `/api/analytics`** - Fetches sentiment breakdown, category breakdown, and metrics
- **GET `/api/feedback/recent?limit=50`** - Fetches recent feedback items
- **GET `/api/feedback/priority?limit=20`** - Fetches high-priority feedback
- **GET `/wordcloud.png`** - Serves the word cloud image
- **POST `/api/feedback`** - Submits new feedback (for future use)

## Features

### Real-time Data
- Dashboard automatically refreshes every 30 seconds
- All charts and metrics update automatically
- Loading states and error handling included

### Components
- **Metric Cards**: Total feedback, positive, negative, high priority counts
- **Sentiment Pie Chart**: Visual breakdown of sentiment distribution
- **Category Bar Chart**: Feedback grouped by category
- **Word Cloud**: Visual representation of common words in feedback

## Configuration

### API Base URL
The API base URL is configured in `react_dashboard/src/services/api.js`:
```javascript
const API_BASE = 'http://localhost:5000/api'
```

To change the Flask port, update this value.

### CORS
CORS is enabled in Flask (`app/__init__.py`) to allow requests from:
- `http://localhost:5173` (Vite default)
- `http://localhost:3000` (alternative React port)
- `http://127.0.0.1:5173`

## Troubleshooting

### "Failed to load dashboard data"
- Ensure Flask backend is running on port 5000
- Check browser console for CORS errors
- Verify database has feedback data

### Word cloud not showing
- Ensure Flask backend is running
- Check that feedback data exists in the database
- Word cloud is generated on-demand by Flask

### Charts not updating
- Dashboard auto-refreshes every 30 seconds
- Check browser console for API errors
- Verify network tab shows successful API calls

## Development

### Adding New API Calls
1. Add function to `react_dashboard/src/services/api.js`
2. Import and use in React components
3. Update CORS config in Flask if needed

### Styling
- Uses Tailwind CSS with dark theme
- Custom colors defined in `tailwind.config.js`
- Dark mode enabled via `class="dark"` on `<html>` tag
