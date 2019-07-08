"use strict";
const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");

// Default module values
let modConfig = {
  "requestTemplate": {},
  "prefix": "prefix"
};
let rsrcPulumiSimpleApi = {};

// ****************************************************************************
// Configure module
// ****************************************************************************
function setModuleConfig(parm) {
  let valList = Object.keys(parm);
  valList.forEach((x) => {
    modConfig[x] = parm[x];
  });

  modConfig.region = new pulumi.Config("aws").require("region");

  // **** NEED TO FIX THIS GARBAGE
  // modConfig.requestTemplate["username"] = `"$input.params('Username')"`;
  // modConfig.requestTemplate["password"] = `"$input.params('Password')"`;
  // modConfig.requestTemplate["serverId"] = `"$input.params('ServerId')"`;
}

// ****************************************************************************
// Create resources
// ****************************************************************************
function rsrcPulumiCreate() {
  // Create the Lambda function first
  rsrcPulumiSimpleApi.lambdaRole = new aws.iam.Role(modConfig.prefix + "LambdaRole", {
    name: modConfig.prefix + "LambdaRole",
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
  });

  rsrcPulumiSimpleApi.lambdaRolePolicy = new aws.iam.RolePolicy(modConfig.prefix + "LambdaRolePolicy", {
    role: rsrcPulumiSimpleApi.lambdaRole.id,
    policy: pulumi.output({
      Version: "2012-10-17",
      Statement: [{
        Action: ["logs:*", "cloudwatch:*"],
        Resource: "*",
        Effect: "Allow",
      }],
    }),
  });

  rsrcPulumiSimpleApi.lambda = new aws.lambda.Function(modConfig.prefix + "LambdaFunc", {
    runtime: aws.lambda.NodeJS10dXRuntime,
    name: modConfig.prefix + "LambdaFunc",
    code: new pulumi.asset.AssetArchive({
      ".": new pulumi.asset.FileArchive("./simplelambda.zip"),
    }),
    timeout: 300,
    handler: "simplelambda.handler",
    role: rsrcPulumiSimpleApi.lambdaRole.arn
  }, { dependsOn: [rsrcPulumiSimpleApi.lambdaRolePolicy] });

  // Create the API Gateway Rest API
  rsrcPulumiSimpleApi.apiRestApi = new aws.apigateway.RestApi(modConfig.prefix + "sFTPAuthAPI", {
    name: modConfig.prefix + "sFTPAuthAPI",
    description: "sFTP Transfer Service Custom IDP api",
    endpointConfiguration: { types: "REGIONAL" }
  });

  rsrcPulumiSimpleApi.apiLogin = new aws.apigateway.Resource(modConfig.prefix + "sFTPAuthAPILogin", {
    parentId: rsrcPulumiSimpleApi.apiRestApi.rootResourceId,
    pathPart: "login",
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
  });

  rsrcPulumiSimpleApi.apiMethod = new aws.apigateway.Method(modConfig.prefix + "sFTPAuthAPIMethod", {
    apiKeyRequired: false,
    authorization: "AWS_IAM",
    httpMethod: "GET",
    requestModels: { "application/json": modConfig.prefix + "sFTPAuthAPIModel" },
    resourceId: rsrcPulumiSimpleApi.apiLogin.id,
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
  }), { dependsOn: [rsrcPulumiSimpleApi.apiModel] };

  rsrcPulumiSimpleApi.apiModel = new aws.apigateway.Model(modConfig.prefix + "sFTPAuthAPIModel", {
    contentType: "application/json",
    description: "a JSON schema",
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
    name: modConfig.prefix + "sFTPAuthAPIModel",
    schema: `{
      "title": "UserUserConfig",
      "type": "object",
      "properties": {
        "HomeDirectory": {
          "type": "string"
        },
        "Role": {
          "type": "string"
        },
        "Policy": {
          "type": "string"
        },
        "PublicKeys": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    }`
  });

  rsrcPulumiSimpleApi.apiRestItegration = new aws.apigateway.Integration(modConfig.prefix + "sFTPAuthAPIIntegration", {
    httpMethod: rsrcPulumiSimpleApi.apiMethod.httpMethod,
    integrationHttpMethod: "POST",
    resourceId: rsrcPulumiSimpleApi.apiLogin.id,
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
    type: "AWS",
    passthroughBehavior: "WHEN_NO_MATCH",
    requestTemplates: modConfig.requestTemplate,
    uri: pulumi.interpolate`arn:aws:apigateway:${modConfig.region}:lambda:path/2015-03-31/functions/${rsrcPulumiSimpleApi.lambda.arn}/invocations`,
  }, { dependsOn: [rsrcPulumiSimpleApi.lambda] });

  rsrcPulumiSimpleApi.apiIntegrationResponse = new aws.apigateway.IntegrationResponse(modConfig.prefix + "sFTPAuthAPIIntegrationResponse", {
    httpMethod: rsrcPulumiSimpleApi.apiMethod.httpMethod,
    resourceId: rsrcPulumiSimpleApi.apiLogin.id,
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
    statusCode: "200"
  }, { dependsOn: [rsrcPulumiSimpleApi.apiRestItegration] });
}

// ****************************************************************************
// Custom output
// ****************************************************************************
function postDeploy() {
  // pulumi.all([
  //   rsrcPulumiSimpleApi.lambda.arn
  // ]).apply(([x]) => {
  //   console.log("Lambda arn:", x);
  // });
}

// ****************************************************************************
// API into this module
// ****************************************************************************
function ddStart(params) {
  setModuleConfig(params);
  rsrcPulumiCreate();
  postDeploy();
}

module.exports.ddStart = ddStart;
module.exports.pulumiResources = rsrcPulumiSimpleApi;
