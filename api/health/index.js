module.exports = async function (context, req) {
    context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: {
                hasAzureOpenAIEndpoint: !!process.env.AZURE_OPENAI_ENDPOINT,
                hasAzureOpenAIKey: !!process.env.AZURE_OPENAI_API_KEY,
                hasDeploymentName: !!process.env.AZURE_OPENAI_DEPLOYMENT_NAME
            }
        })
    };
};