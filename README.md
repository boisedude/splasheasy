# SplashEasy - Pool and Hot Tub Care Made Simple

An AI-powered web application that analyzes pool and hot tub water chemistry and provides personalized treatment recommendations.

## Features

- **AI-Powered Analysis**: Uses OpenAI to analyze water chemistry readings
- **Safety-First Approach**: Clear safety status indicators (Safe/Caution/Not Safe)
- **Step-by-Step Guidance**: Detailed action plans with chemical dosages
- **Test Strip Support**: Works with both numeric readings and test strip colors
- **Educational Content**: Learn about water chemistry principles
- **Responsive Design**: Works on desktop and mobile devices

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Azure Functions + OpenAI API
- **Deployment**: Azure Static Web Apps
- **Storage**: Local storage for reading history

## Local Development

### Prerequisites

- Node.js 18+
- Azure Functions Core Tools
- OpenAI API key

### Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   cd api && npm install
   ```

2. **Configure environment variables**:
   ```bash
   # Copy and update environment files
   cp .env.example .env.local
   cp api/local.settings.json.example api/local.settings.json
   
   # Add your OpenAI API key to api/local.settings.json
   ```

3. **Start development servers**:
   ```bash
   # Terminal 1: Start the frontend
   npm run dev
   
   # Terminal 2: Start the Azure Functions backend
   cd api && npm start
   ```

4. **Open browser**: http://localhost:5173

## Deployment to Azure

### Prerequisites

- Azure account
- GitHub repository

### Steps

1. **Create Azure Static Web App**:
   - Go to Azure Portal → Create a resource → Static Web Apps
   - Connect to your GitHub repository
   - Build Details:
     - Framework: React
     - App location: `/`
     - API location: `api`
     - Output location: `dist`

2. **Configure environment variables**:
   - In Azure Portal → Static Web Apps → Configuration
   - Add `OPENAI_API_KEY` with your OpenAI API key

3. **Deploy**:
   - Push to your main branch
   - GitHub Actions will automatically build and deploy

## API Endpoints

### POST /api/analyzeWater

Analyzes water chemistry readings and returns safety verdict and recommendations.

**Request Body**:
```json
{
  "audience": "homeowner",
  "body": "hot_tub",
  "volume_gal": 350,
  "sanitizer": "bromine",
  "input_mode": "strip",
  "br": 2,
  "ph": 7.8,
  "ta": 80,
  "visible_issues": ["odor"],
  "recent_actions": ["heavy_use"]
}
```

**Response**:
```json
{
  "safety": {
    "status": "caution",
    "reasons": ["pH is slightly high"]
  },
  "action_plan": [
    {
      "step": 1,
      "action": "Lower pH to 7.4-7.6",
      "dosage": {
        "chemical": "pH decreaser",
        "amount": { "value": 2, "unit": "oz" }
      }
    }
  ],
  "targets": { "pH": "7.4-7.6", "Bromine": "3-5 ppm" },
  "education": { "quick_tips": [...], "notes": [...] },
  "disclaimers": [...]
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support, please create an issue on GitHub or contact the development team.

## Safety Disclaimer

This application provides general water chemistry guidance and is not a substitute for professional advice. Always follow chemical manufacturer instructions and consult pool professionals for complex issues.