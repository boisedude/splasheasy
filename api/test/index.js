module.exports = async function (context, req) {
    context.log('Simple test function called');

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            message: 'Test function works!',
            method: req.method,
            timestamp: new Date().toISOString(),
            env_check: {
                node_version: process.version,
                platform: process.platform,
                has_openai_endpoint: !!process.env.AZURE_OPENAI_ENDPOINT,
                has_openai_key: !!process.env.AZURE_OPENAI_API_KEY,
                has_deployment_name: !!process.env.AZURE_OPENAI_DEPLOYMENT_NAME
            }
        })
    };
};