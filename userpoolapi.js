"use strict";
const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");
const awsUserPoolFunc = require("./userpoolfunc.js");

// Default module values
let modConfig = {
  "requestTemplate": {},
};
let rsrcPulumiUserPoolApi = {};

// ****************************************************************************
// Configure module
// ****************************************************************************
function setModuleConfig(parm) {
  let valList = Object.keys(parm);
  valList.forEach((x) => {
    modConfig[x] = parm[x];
  });

  modConfig.requestTemplate["username"] = `"$input.params('Username')"`;
  modConfig.requestTemplate["password"] = `"$util.escapeJavaScript($input.params('Password')).replaceAll("\\'","'")"`;
  modConfig.requestTemplate["serverId"] = `"$input.params('ServerId')"`;
}

// ****************************************************************************
// Create resources
// ****************************************************************************
function rsrcPulumiCreate() {
  // Create the API Gateway Rest API
  rsrcPulumiUserPoolApi.apiRestApi = new aws.apigateway.RestApi(modConfig.prefix + "sFTPAuthAPI", {
    // body: rsrcPulumiUserPool.lambda.arn.apply(lambdaArn => swaggerSpec(lambdaArn)),
    name: modConfig.prefix + "sFTPAuthAPI",
    description: "sFTP Transfer Service Custom IDP api",
    endpointConfiguration: { types: "REGIONAL" }
  });

  // Path: /servers/{serverId}/users/{username}/config
  // API Resources
  rsrcPulumiUserPoolApi.apiServersRsrc = new aws.apigateway.Resource(modConfig.prefix + "sFTPAuthAPIServersRsrc", {
    parentId: rsrcPulumiUserPoolApi.apiRestApi.rootResourceId,
    pathPart: "servers",
    restApi: rsrcPulumiUserPoolApi.apiRestApi.id,
  });

  rsrcPulumiUserPoolApi.apiServerIdRsrc = new aws.apigateway.Resource(modConfig.prefix + "sFTPAuthAPIServerIdRsrc", {
    parentId: rsrcPulumiUserPoolApi.apiServersRsrc.id,
    pathPart: "{serverId}",
    restApi: rsrcPulumiUserPoolApi.apiRestApi.id,
  });

  rsrcPulumiUserPoolApi.apiUsersRsrc = new aws.apigateway.Resource(modConfig.prefix + "sFTPAuthAPIUsersRsrc", {
    parentId: rsrcPulumiUserPoolApi.apiServerIdRsrc.id,
    pathPart: "users",
    restApi: rsrcPulumiUserPoolApi.apiRestApi.id,
  });

  rsrcPulumiUserPoolApi.apiUsernameRsrc = new aws.apigateway.Resource(modConfig.prefix + "sFTPAuthAPIUsernameRsrc", {
    parentId: rsrcPulumiUserPoolApi.apiUsersRsrc.id,
    pathPart: "{username}",
    restApi: rsrcPulumiUserPoolApi.apiRestApi.id,
  });

  rsrcPulumiUserPoolApi.apiConfigRsrc = new aws.apigateway.Resource(modConfig.prefix + "sFTPAuthAPIConfigRsrc", {
    parentId: rsrcPulumiUserPoolApi.apiUsernameRsrc.id,
    pathPart: "config",
    restApi: rsrcPulumiUserPoolApi.apiRestApi.id,
  });

  // API Methods and Responses
  rsrcPulumiUserPoolApi.apiModel = new aws.apigateway.Model(modConfig.prefix + "sFTPAuthAPIModel", {
    contentType: "application/json",
    description: "a JSON schema",
    restApi: rsrcPulumiUserPoolApi.apiRestApi.id,
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

  rsrcPulumiUserPoolApi.apiMethod = new aws.apigateway.Method(modConfig.prefix + "sFTPAuthAPIMethod", {
    apiKeyRequired: false,
    authorization: "AWS_IAM",
    httpMethod: "GET",
    requestModels: { "application/json": rsrcPulumiUserPoolApi.apiModel.name },
    resourceId: rsrcPulumiUserPoolApi.apiConfigRsrc.id,
    restApi: rsrcPulumiUserPoolApi.apiRestApi.id,
  }), { dependsOn: [rsrcPulumiUserPoolApi.apiModel] };

  rsrcPulumiUserPoolApi.apiRestItegration = new aws.apigateway.Integration(modConfig.prefix + "sFTPAuthAPIIntegration", {
    httpMethod: rsrcPulumiUserPoolApi.apiMethod.httpMethod,
    integrationHttpMethod: "POST",
    resourceId: rsrcPulumiUserPoolApi.apiConfigRsrc.id,
    restApi: rsrcPulumiUserPoolApi.apiRestApi.id,
    type: "AWS",
    passthroughBehavior: "WHEN_NO_MATCH",
    requestTemplates: modConfig.requestTemplate,
    uri: pulumi.interpolate`arn:aws:apigateway:${aws.region}:lambda:path/2015-03-31/functions/${awsUserPoolFunc.pulumiResources.lambda.arn}/invocations`,
  });

  rsrcPulumiUserPoolApi.apiIntegrationResponse = new aws.apigateway.IntegrationResponse(modConfig.prefix + "sFTPAuthAPIIntegrationResponse", {
    httpMethod: rsrcPulumiUserPoolApi.apiMethod.httpMethod,
    resourceId: rsrcPulumiUserPoolApi.apiConfigRsrc.id,
    restApi: rsrcPulumiUserPoolApi.apiRestApi.id,
    statusCode: "200"
  }, { dependsOn: [rsrcPulumiUserPoolApi.apiMethod] });

  // rsrcPulumiUserPoolApi.apiResponse = new aws.apigateway.Response(modConfig.prefix + "sFTPAuthAPIResponse", {
  // });

  rsrcPulumiUserPoolApi.apiMethodResponse = new aws.apigateway.MethodResponse("200", {
    httpMethod: rsrcPulumiUserPoolApi.apiMethod.httpMethod,
    resourceId: rsrcPulumiUserPoolApi.apiConfigRsrc.id,
    restApi: rsrcPulumiUserPoolApi.apiRestApi.id,
    statusCode: "200"
  });

  // Create a deployment of the Rest API.
  rsrcPulumiUserPoolApi.apiDeployment = new aws.apigateway.Deployment(modConfig.prefix + "sFTPAuthAPIDeployment", {
    restApi: rsrcPulumiUserPoolApi.apiRestApi,
    // Note: Set to empty to avoid creating an implicit stage, we'll create it explicitly below instead.
    stageName: "placeholder",
  }, { dependsOn: [rsrcPulumiUserPoolApi.apiMethod] });

  // Create a stage, which is an addressable instance of the Rest API. Set it to point at the latest deployment.
  rsrcPulumiUserPoolApi.apiStage = new aws.apigateway.Stage(modConfig.prefix + "sFTPAuthAPIStage", {
    restApi: rsrcPulumiUserPoolApi.apiRestApi,
    deployment: rsrcPulumiUserPoolApi.apiDeployment,
    httpMethod: "*",
    resourcePath: "/*",
    stageName: "Prod",
  });

  // Give permissions from API Gateway to invoke the Lambda
  rsrcPulumiUserPoolApi.apiInvokePermission = new aws.lambda.Permission(modConfig.prefix + "sFTPAuthAPILambdaPermission", {
    action: "lambda:invokeFunction",
    function: awsUserPoolFunc.pulumiResources.lambda,
    principal: "apigateway.amazonaws.com",
    sourceArn: pulumi.interpolate`${rsrcPulumiUserPoolApi.apiDeployment.executionArn}*/*`,
  });
}

// ****************************************************************************
// Custom output
// ****************************************************************************
function postDeploy() {
  // pulumi.all([
  //   rsrcPulumiUserPool.sftpServer.id,
  //   rsrcPulumiUserPool.homeBucket.id,
  //   rsrcPulumiUserPool.sftpServer.endpoint
  // ]).apply(([x, y, z]) => {
  //   console.log("sftp Info:", x);
  //   console.log("s3 bucket Info:", y);
  //   console.log("sftp Endpt:", z);
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
module.exports.pulumiResources = rsrcPulumiUserPoolApi;
