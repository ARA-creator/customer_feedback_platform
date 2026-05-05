# Frontend

This is the Vite + React dashboard for the Customer Feedback Platform.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

## Build

```bash
cd frontend
npm run build
```

## Environment

- `VITE_BACKEND_ORIGIN`: backend origin such as `http://localhost:5000`

## Structure

- `src/app/`: app bootstrap and top-level shell
- `src/features/`: feature-oriented modules such as auth, dashboard, inbox, reports
- `src/shared/`: reusable layout, styling, utilities, and API client setup

## Conventions

- feature-specific API calls live inside each feature's `services/` folder
- shared cross-cutting code belongs in `src/shared/`
- page-sized components live under the appropriate feature, not in a flat global components folder
# Feedback Dashboard - React Version

A modern, dark-themed React dashboard that replicates the Flask dashboard design.

## Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn

### Installation

```bash
cd react_dashboard
npm install
```

### Run Development Server

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Build for Production

```bash
npm run build
```

## Project Structure

```
react_dashboard/
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx      # Left navigation sidebar
│   │   ├── Header.jsx       # Top header with breadcrumbs
│   │   └── Dashboard.jsx    # Main dashboard with charts
│   ├── App.jsx              # Main app component
│   ├── main.jsx             # Entry point
│   └── index.css            # Tailwind CSS styles
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Dependencies

**Core:**
- `react` ^18.2.0
- `react-dom` ^18.2.0
- `recharts` ^2.10.3 (for charts)

**Dev Dependencies:**
- `vite` ^5.0.8 (build tool)
- `@vitejs/plugin-react` ^4.2.1
- `tailwindcss` ^3.4.0
- `autoprefixer` ^10.4.16
- `postcss` ^8.4.32

## Features

✅ Dark theme (#0a0a0a background)
✅ Purple/blue accent colors
✅ Responsive sidebar navigation
✅ Sentiment distribution pie chart
✅ Category feedback bar chart
✅ Modern, clean UI
✅ Hover effects and transitions

## Connecting Real Data

To connect to your Flask API:

1. **Install axios:**
   ```bash
   npm install axios
   ```

2. **Create API service** (`src/services/api.js`):
   ```javascript
   import axios from 'axios'

   const API_BASE = 'http://localhost:5000/api'

   export const getFeedbackStats = async () => {
     const response = await axios.get(`${API_BASE}/analytics`)
     return response.data
   }
   ```

3. **Update Dashboard component:**
   ```javascript
   import { useState, useEffect } from 'react'
   import { getFeedbackStats } from '../services/api'

   function Dashboard() {
     const [sentimentData, setSentimentData] = useState([])
     const [categoryData, setCategoryData] = useState([])

     useEffect(() => {
       const fetchData = async () => {
         const stats = await getFeedbackStats()
         // Transform API data to chart format
         setSentimentData(transformSentimentData(stats.sentiment))
         setCategoryData(transformCategoryData(stats.categories))
       }
       fetchData()
     }, [])

     // ... rest of component
   }
   ```

## Customization

### Colors
Edit `tailwind.config.js` to change accent colors:
```javascript
colors: {
  'purple-accent': '#8b5cf6',  // Change this
}
```

### Chart Styles
Modify colors in `Dashboard.jsx`:
- Pie chart: `sentimentData` array colors
- Bar chart: `fill` prop in `<Bar>` component

## Improvements for Production

1. **Add loading states** - Show spinners while fetching data
2. **Error handling** - Display error messages if API fails
3. **Real-time updates** - Use WebSockets or polling for live data
4. **Authentication** - Add login/auth flow
5. **Routing** - Use React Router for multiple pages
6. **State management** - Add Redux/Zustand for complex state
7. **Testing** - Add Jest + React Testing Library
8. **TypeScript** - Convert to .tsx for type safety

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm run build
# Upload dist/ folder to Netlify
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview"]
```

## Notes

- Currently uses mock/hardcoded data
- Charts are responsive and work on mobile
- Sidebar can be made collapsible for mobile (add toggle button)
- All styling uses Tailwind CSS classes
- Dark mode is default (no toggle needed)
