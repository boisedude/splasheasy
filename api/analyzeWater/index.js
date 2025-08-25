const { analyzeWater } = require('../dist/src/functions/analyzeWater');

module.exports = async function (context, req) {
    const httpRequest = {
        method: req.method,
        json: async () => req.body,
        headers: req.headers,
        url: req.url,
        query: req.query
    };

    const response = await analyzeWater(httpRequest, context);
    
    context.res = {
        status: response.status,
        headers: response.headers,
        body: response.body
    };
};