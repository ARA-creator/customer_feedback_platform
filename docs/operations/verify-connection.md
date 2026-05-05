# Verifying React ↔ Flask Connection

## How to Verify React is Fetching from Flask

### 1. Check Browser Console
Open your browser's Developer Tools (F12) and check the Console tab. You should see:
```
API Request: GET /analytics
API Request: GET /feedback/recent?limit=20
API Request: GET /feedback/priority?limit=10
```

### 2. Check Network Tab
In Developer Tools → Network tab, you should see:
- `GET http://localhost:5000/api/analytics` (Status: 200)
- `GET http://localhost:5000/api/feedback/recent?limit=20` (Status: 200)
- `GET http://localhost:5000/api/feedback/priority?limit=10` (Status: 200)
- `GET http://localhost:5000/wordcloud.png` (Status: 200)

### 3. Test Flask API Directly
```bash
# Test analytics endpoint
curl http://localhost:5000/api/analytics

# Test recent feedback
curl http://localhost:5000/api/feedback/recent?limit=5

# Test priority queue
curl http://localhost:5000/api/feedback/priority?limit=5
```

### 4. Current Configuration

**React API Service** (`react_dashboard/src/services/api.js`):
- Base URL: `http://localhost:5000/api`
- Uses axios for HTTP requests
- Has request/response interceptors for debugging

**Flask CORS** (`app/__init__.py`):
- Allows requests from `http://localhost:5173` (Vite default)
- Allows requests from `http://localhost:3000` (alternative React port)
- Allows requests from `http://127.0.0.1:5173`

**Dashboard Component** (`react_dashboard/src/components/Dashboard.jsx`):
- Calls `getAnalytics()` on mount
- Calls `getRecentFeedback(20)` on mount
- Calls `getPriorityQueue(10)` on mount
- Auto-refreshes every 30 seconds

## Troubleshooting

### If React shows "Failed to load dashboard data":
1. **Check Flask is running**: `curl http://localhost:5000/api/analytics`
2. **Check CORS**: Look for CORS errors in browser console
3. **Check API URL**: Verify `API_BASE` in `api.js` matches Flask port
4. **Check network tab**: See if requests are being made and what status codes they return

### If data is not updating:
- Dashboard auto-refreshes every 30 seconds
- Check browser console for API errors
- Verify Flask database has data: Check if `/api/analytics` returns data

### If you see CORS errors:
- Ensure Flask CORS is enabled (check `app/__init__.py`)
- Verify the React dev server port matches CORS allowed origins
- Check that both Flask (port 5000) and React (port 5173) are running
