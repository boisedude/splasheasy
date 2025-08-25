module.exports = async function (context, req) {
    try {
        const { analyzeWater } = require('../dist/src/functions/analyzeWater');

        // Create a simplified HttpRequest-like object
        const httpRequest = {
            method: req.method,
            json: async () => req.body || {},
            headers: req.headers || {},
            url: req.url || '',
            query: req.query || {}
        };

        const response = await analyzeWater(httpRequest, context);
        
        context.res = {
            status: response.status || 200,
            headers: response.headers || {},
            body: response.body || ''
        };
    } catch (error) {
        context.log.error('Function execution failed:', error);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: 'Internal server error', 
                details: error.message,
                stack: error.stack 
            })
        };
    }
};