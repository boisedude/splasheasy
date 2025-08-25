import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { OpenAIService } from '../openai-service';
import { Reading } from '../types';

export async function analyzeWater(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('HTTP trigger function processed a request for water analysis.');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        };
    }

    try {
        // Validate request method
        if (request.method !== 'POST') {
            return {
                status: 405,
                headers: { 
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }

        // Get Azure OpenAI configuration from environment
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const apiKey = process.env.AZURE_OPENAI_API_KEY;
        const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
        
        if (!endpoint || !apiKey || !deploymentName) {
            context.log('Azure OpenAI configuration missing', { endpoint: !!endpoint, apiKey: !!apiKey, deploymentName: !!deploymentName });
            return {
                status: 500,
                headers: { 
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ error: 'Service configuration error' })
            };
        }

        // Parse request body
        const reading: Reading = await request.json() as Reading;
        
        // Basic validation
        if (!reading || !reading.volume_gal || !reading.sanitizer) {
            return {
                status: 400,
                headers: { 
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ error: 'Invalid reading data' })
            };
        }

        // Initialize Azure OpenAI service and analyze
        const openaiService = new OpenAIService(endpoint, apiKey, deploymentName);
        const verdict = await openaiService.analyzeWaterReading(reading);

        return {
            status: 200,
            headers: { 
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(verdict)
        };

    } catch (error) {
        context.log('Error processing request:', error);
        return {
            status: 500,
            headers: { 
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
}

app.http('analyzeWater', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: analyzeWater
});