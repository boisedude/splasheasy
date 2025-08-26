import express from 'express';
import path from 'path';
import { OpenAI } from 'openai';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static('dist'));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const fs = require('fs');
  const distExists = fs.existsSync(path.join(__dirname, 'dist'));
  const publicExists = fs.existsSync(path.join(__dirname, 'public'));
  
  let distContents = [];
  let publicContents = [];
  
  try {
    if (distExists) {
      distContents = fs.readdirSync(path.join(__dirname, 'dist'));
    }
    if (publicExists) {
      publicContents = fs.readdirSync(path.join(__dirname, 'public'));
    }
  } catch (e) {
    // ignore errors
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: {
      hasAzureOpenAIEndpoint: !!process.env.AZURE_OPENAI_ENDPOINT,
      hasAzureOpenAIKey: !!process.env.AZURE_OPENAI_API_KEY,
      hasDeploymentName: !!process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      nodeVersion: process.version
    },
    filesystem: {
      distExists,
      publicExists,
      distContents,
      publicContents,
      currentDir: __dirname
    }
  });
});

// API endpoint for water analysis
app.post('/api/analyzeWater', async (req, res) => {
  console.log('Received water analysis request');

  try {
    // Get Azure OpenAI configuration
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    
    if (!endpoint || !apiKey || !deploymentName) {
      console.log('Azure OpenAI configuration missing', { 
        endpoint: !!endpoint, 
        apiKey: !!apiKey, 
        deploymentName: !!deploymentName 
      });
      return res.status(500).json({ error: 'Service configuration error' });
    }

    const reading = req.body;
    
    // Basic validation
    if (!reading || !reading.volume_gal || !reading.sanitizer) {
      return res.status(400).json({ error: 'Invalid reading data' });
    }

    // Initialize Azure OpenAI
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: `${endpoint}/openai/deployments/${deploymentName}`,
      defaultQuery: { 'api-version': '2024-02-15-preview' },
      defaultHeaders: {
        'api-key': apiKey,
      },
    });

    // Build analysis prompt
    const prompt = `Analyze this ${reading.body} water chemistry reading for a ${reading.audience}:

READINGS:
- Body: ${reading.body}
- Volume: ${reading.volume_gal} gallons  
- Sanitizer: ${reading.sanitizer}
- Visible Issues: ${reading.visible_issues?.join(', ') || 'none'}
- Recent Actions: ${reading.recent_actions?.join(', ') || 'none'}

Provide a complete safety assessment with:
1. Safety status (safe/caution/not_safe) and clear reasons
2. Primary issues and secondary risks
3. Step-by-step action plan with specific dosages
4. Target ranges for this setup
5. Educational tips and follow-up guidance

Format as JSON matching this structure:
{
  "safety": { "status": "safe|caution|not_safe", "reasons": ["..."] },
  "diagnosis": { "primary_issues": ["..."], "secondary_risks": ["..."] },
  "action_plan": [{ "step": 1, "action": "...", "dosage": {...} }],
  "targets": { "pH": "7.4-7.6", ... },
  "education": { "quick_tips": ["..."], "notes": ["..."] },
  "follow_up": { "retest_checklist": ["..."], "when": "...", "what_to_log": ["..."] },
  "validator": { "flags": ["..."], "severity": "info", "confidence": 0.8 },
  "disclaimers": ["..."]
}`;

    const completion = await openai.chat.completions.create({
      model: "", // Model name not needed for Azure OpenAI deployments
      messages: [
        {
          role: "system",
          content: "You are an expert pool and hot tub water chemistry advisor. Always prioritize safety and provide specific actionable guidance."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    const verdict = JSON.parse(response);
    res.json(verdict);

  } catch (error) {
    console.error('Error processing request:', error);
    
    // Return fallback verdict
    const fallbackVerdict = {
      safety: {
        status: "caution",
        reasons: ["AI analysis unavailable - using basic safety check"]
      },
      diagnosis: {
        primary_issues: ["Service unavailable"],
        secondary_risks: ["Manual testing recommended"]
      },
      action_plan: [{
        step: 1,
        action: "Retest water chemistry manually and consult local pool professional",
        order_of_operations: "Verify all readings before adding chemicals",
        retest_after_minutes: 60
      }],
      targets: req.body?.body === "hot_tub" ? {
        "Sanitizer": "3-5 ppm",
        "pH": "7.4-7.6", 
        "TA": "50-80 ppm",
        "CH": "150-250 ppm"
      } : {
        "FC": "1-3 ppm",
        "pH": "7.4-7.6",
        "TA": "60-90 ppm", 
        "CH": "200-400 ppm",
        "CYA": "30-50 ppm"
      },
      education: {
        quick_tips: ["Always add chemicals one at a time", "Keep pump running when adding chemicals"],
        notes: ["AI service temporarily unavailable - manual testing recommended"]
      },
      follow_up: {
        retest_checklist: ["All parameters"],
        when: "After 1 hour circulation",
        what_to_log: ["Before/after readings"]
      },
      validator: {
        flags: ["Service unavailable - using fallback analysis"],
        severity: "warn",
        confidence: 0.3
      },
      disclaimers: [
        "This is a fallback analysis due to service issues",
        "Consult pool professional for accurate assessment"
      ]
    };

    res.json(fallbackVerdict);
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`SplashEasy server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`API endpoint: http://localhost:${port}/api/analyzeWater`);
});

export default app;