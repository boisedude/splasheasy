const { OpenAI } = require('openai');

module.exports = async function (context, req) {
    context.log('HTTP trigger function processed a request for water analysis.');

    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: headers
        };
        return;
    }

    try {
        // Validate request method
        if (req.method !== 'POST') {
            context.res = {
                status: 405,
                headers: headers,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
            return;
        }

        // Get Azure OpenAI configuration from environment
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const apiKey = process.env.AZURE_OPENAI_API_KEY;
        const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
        
        if (!endpoint || !apiKey || !deploymentName) {
            context.log('Azure OpenAI configuration missing', { 
                endpoint: !!endpoint, 
                apiKey: !!apiKey, 
                deploymentName: !!deploymentName 
            });
            context.res = {
                status: 500,
                headers: headers,
                body: JSON.stringify({ error: 'Service configuration error' })
            };
            return;
        }

        // Parse request body
        const reading = req.body;
        
        // Basic validation
        if (!reading || !reading.volume_gal || !reading.sanitizer) {
            context.res = {
                status: 400,
                headers: headers,
                body: JSON.stringify({ error: 'Invalid reading data' })
            };
            return;
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

        context.res = {
            status: 200,
            headers: headers,
            body: JSON.stringify(verdict)
        };

    } catch (error) {
        context.log('Error processing request:', error);
        
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
            targets: reading?.body === "hot_tub" ? {
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

        context.res = {
            status: 200,
            headers: headers,
            body: JSON.stringify(fallbackVerdict)
        };
    }
};