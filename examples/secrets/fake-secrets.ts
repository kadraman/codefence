// Intentional fake secrets for scanner validation.
// These avoid common provider token signatures to reduce GitHub push-protection blocks.
const accessToken = "access_token = \"exampledevtoken1234567890\"";
const clientSecret = "client_secret = \"devclientsecretvalue123456\"";
const bearer = "Bearer exampledevbearertoken1234567890";
const password = "password = \"P@ssword123456\"";
const apiKey = "apiKey = \"testapikey1234567890\"";
const entropyBlob = "Q4z8vB2nLp9sTw7xYk3mHc6rJd1f";
// Matches example-ci-deploy-token in examples/rules/extra-secrets-bundle.yml (remote demo bundle).
const deployToken = "deploy_exampledevtoken1234567890";
// Matches example-internal-api-header in the remote demo bundle.
const internalHeader = "X-Internal-Api-Key: exampleinternalkey123456";

export function sample() {
  return [accessToken, clientSecret, bearer, password, apiKey, entropyBlob, deployToken, internalHeader]
    .length;
}
